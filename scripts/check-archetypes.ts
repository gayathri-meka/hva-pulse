import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function isBruteForce(progression: string): boolean {
  const parts = progression.split(' -> ')
  if (parts.length < 4) return false
  const scores = parts.map((s) => { const [a, b] = s.split('/'); return b ? parseFloat(a) / parseFloat(b) : 0 })
  const early = scores.slice(0, -1)
  const last = scores[scores.length - 1]
  const avgEarly = early.reduce((a, b) => a + b, 0) / early.length
  return avgEarly < 0.5 && last >= 0.9 && early.length >= 3
}

async function main() {
  const { data } = await supabase.from('learner_analysis').select('email, raw_data, analysis_text')
  if (!data) return

  const { data: users } = await supabase.from('users').select('email, name').in('email', data.map((d) => d.email))
  const nameMap = new Map((users ?? []).map((u) => [u.email, u.name ?? u.email]))

  const results: { name: string; bf: number; firstPass: number; totalQs: number; arch: string }[] = []

  for (const row of data) {
    const rd = row.raw_data as any
    const cs = rd?.course_summary ?? []
    const sp = rd?.score_progressions ?? []

    let bf = 0
    for (const p of sp) {
      if (isBruteForce(p.score_progression ?? '')) bf++
    }

    const totalFirst = cs.reduce((s: number, c: any) => s + (parseFloat(c.first_attempt_passed) || 0), 0)
    const totalQs = cs.reduce((s: number, c: any) => s + (parseFloat(c.distinct_questions) || 0), 0)
    const firstPass = totalQs > 0 ? Math.round((totalFirst / totalQs) * 100) : 0

    const text = row.analysis_text ?? ''
    let arch = 'unknown'
    if (text.includes('brute-forcing')) arch = 'grinder'
    else if (text.includes('inactive for')) arch = 'ghoster'
    else if (text.includes('limited engagement')) arch = 'skimmer'
    else if (text.includes('struggling fundamentally')) arch = 'struggler'
    else if (text.includes('below the cohort average')) arch = 'needs-improvement'
    else if (text.includes('performing steadily')) arch = 'steady'

    results.push({ name: nameMap.get(row.email) ?? row.email, bf, firstPass, totalQs, arch })
  }

  // Distribution
  console.log('ARCHETYPE DISTRIBUTION:')
  const archCounts: Record<string, number> = {}
  for (const r of results) {
    archCounts[r.arch] = (archCounts[r.arch] ?? 0) + 1
  }
  for (const [a, c] of Object.entries(archCounts).sort()) {
    console.log('  ' + a + ': ' + c)
  }

  console.log('\nBRUTE-FORCE DISTRIBUTION (sorted by BF count desc):')
  results.sort((a, b) => b.bf - a.bf)
  for (const r of results) {
    console.log('  ' + r.bf.toString().padStart(3) + ' bf | ' + r.firstPass.toString().padStart(3) + '% 1st | ' + r.totalQs.toString().padStart(5) + ' qs | ' + r.arch.padEnd(10) + ' | ' + r.name)
  }
}
main().catch(console.error)
