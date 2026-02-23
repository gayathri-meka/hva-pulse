/**
 * One-time import script: learner interest form → Supabase
 *
 * Usage:
 *   npx tsx scripts/import-interest.ts --dry-run   # preview only, no writes
 *   npx tsx scripts/import-interest.ts --commit     # actually insert
 *
 * Reads .env.local automatically. Needs:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import fs   from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'
import { config as loadEnv } from 'dotenv'

// ── Config ────────────────────────────────────────────────────────────────────

if (fs.existsSync('.env.local')) loadEnv({ path: '.env.local' })

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Missing required environment variables.')
  console.error('Add these to .env.local:')
  if (!SUPABASE_URL)         console.error('  NEXT_PUBLIC_SUPABASE_URL=<your project URL>')
  if (!SUPABASE_SERVICE_KEY) console.error('  SUPABASE_SERVICE_ROLE_KEY=<your service role key (Supabase → Settings → API)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ── Column indexes in learner_interest.csv ────────────────────────────────────
const COL_EMAIL       = 1
const COL_LEARNER_ID  = 2
const COL_RESUME      = 4
const COL_OPPORTUNITY = 5
const COL_APPLYING    = 6
const COL_REASON      = 7

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCsv(filePath: string): string[][] {
  const raw = fs.readFileSync(path.resolve(filePath), 'utf-8')
  const result = Papa.parse<string[]>(raw, { skipEmptyLines: true })
  return result.data
}

function cell(row: string[], idx: number): string {
  return (row[idx] ?? '').trim()
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isCommit = process.argv.includes('--commit')
  const isDryRun = !isCommit
  console.log(`\nMode: ${isCommit ? 'COMMIT' : 'DRY RUN'}\n`)

  // 1. Load CSVs
  const mappingRows  = parseCsv('migrations/role_mapping_for_import.csv')
  const interestRows = parseCsv('migrations/learner_interest.csv')

  // 2. Build sheet_role_name → role_id map (skip header row)
  const roleMap: Record<string, string> = {}
  for (const row of mappingRows.slice(1)) {
    const name   = cell(row, 0)
    const roleId = cell(row, 1)
    if (name && roleId) roleMap[name] = roleId
  }

  // 3. Process interest rows (skip header)
  const dataRows = interestRows.slice(1)

  // Counters
  let totalRows        = 0
  let appliedCount     = 0
  let notInterestedCount = 0
  let skippedCount     = 0
  let missingUsers     = 0
  let missingRoles     = 0

  // Batches for commit
  type AppRow  = { role_id: string; user_id: string; learner_id: string; status: string; resume_url: string | null; updated_at: string }
  type PrefRow = { user_id: string; role_id: string; preference: string; reasons: string[] }

  const applications: AppRow[]  = []
  const preferences:  PrefRow[] = []
  const issues:       string[]  = []

  for (const row of dataRows) {
    totalRows++

    const email       = cell(row, COL_EMAIL)
    const learnerId   = cell(row, COL_LEARNER_ID)
    const resumeUrl   = cell(row, COL_RESUME) || null
    const opportunity = cell(row, COL_OPPORTUNITY)
    const applying    = cell(row, COL_APPLYING)
    const reason      = cell(row, COL_REASON)

    // Skip rows with no opportunity
    if (!opportunity) {
      skippedCount++
      issues.push(`SKIP [no opportunity]   ${email}`)
      continue
    }

    // Lookup role
    const roleId = roleMap[opportunity]
    if (!roleId) {
      skippedCount++
      missingRoles++
      issues.push(`SKIP [role not mapped]  ${email} | "${opportunity}"`)
      continue
    }

    // Determine intent
    let intent: 'applied' | 'not_interested' | 'skip'
    let reasons: string[]

    if (applying === 'Yes' || applying === 'N/A') {
      intent  = 'applied'
      reasons = []
    } else if (applying === 'No') {
      intent  = 'not_interested'
      const hasReason = reason && reason !== 'N/A'
      reasons = hasReason ? [reason] : ['Others']
    } else {
      skippedCount++
      issues.push(`SKIP [unknown value "${applying}"] ${email}`)
      continue
    }

    // Lookup user by email
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!user) {
      skippedCount++
      missingUsers++
      issues.push(`SKIP [user not found]   ${email}`)
      continue
    }

    // Collect
    if (intent === 'applied') {
      appliedCount++
      applications.push({
        role_id:    roleId,
        user_id:    user.id,
        learner_id: learnerId || user.id,
        status:     'applied',
        resume_url: resumeUrl,
        updated_at: new Date().toISOString(),
      })
    } else {
      notInterestedCount++
      preferences.push({
        user_id:    user.id,
        role_id:    roleId,
        preference: 'not_interested',
        reasons,
      })
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('=== SUMMARY ===')
  console.log(`Total rows processed : ${totalRows}`)
  console.log(`Applied (→ applications)     : ${appliedCount}`)
  console.log(`Not interested (→ prefs)     : ${notInterestedCount}`)
  console.log(`Skipped                      : ${skippedCount}`)
  console.log(`  └ missing users            : ${missingUsers}`)
  console.log(`  └ missing/unmapped roles   : ${missingRoles}`)

  if (issues.length > 0) {
    console.log('\n=== ISSUES ===')
    issues.forEach((msg) => console.log(' ', msg))
  }

  if (isDryRun) {
    console.log('\nDry run complete — nothing was written. Run with --commit to insert.')
    return
  }

  // ── Commit ───────────────────────────────────────────────────────────────
  console.log('\n=== INSERTING ===')

  if (applications.length > 0) {
    const { error } = await supabase
      .from('applications')
      .upsert(applications, { onConflict: 'role_id,user_id' })
    if (error) console.error(`  ✗ applications: ${error.message}`)
    else       console.log(`  ✓ Upserted ${applications.length} applications`)
  }

  if (preferences.length > 0) {
    const { error } = await supabase
      .from('role_preferences')
      .upsert(preferences, { onConflict: 'user_id,role_id' })
    if (error) console.error(`  ✗ role_preferences: ${error.message}`)
    else       console.log(`  ✓ Upserted ${preferences.length} role_preferences`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
