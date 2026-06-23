'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/auth'
import { normEmail, type ProspectComment } from '@/lib/prospectComments'
import { buildProspectIndex, matchSignup } from '@/lib/signupMatch'
import {
  syncTableToSheet,
  getFirstTabName,
  parseSpreadsheetId,
  type SyncToSheetResult,
} from '@/lib/sheetSync'

// prospect_comments has RLS (admin/staff). We write via the service-role client
// to match the rest of admissions; requireStaff() still gates the action.
function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

function revalidateAdmissions() {
  revalidatePath('/admissions/prospects')
  revalidatePath('/admissions/learner-applications')
}

type AddResult = { ok: true; comment: ProspectComment } | { ok: false; error: string }

/** Append a comment to an email's thread. Shared across both admissions tabs. */
export async function addProspectComment(email: string, body: string): Promise<AddResult> {
  const user = await requireStaff()
  const key = normEmail(email)
  const text = body.trim()
  if (!key) return { ok: false, error: 'This row has no email to attach a comment to.' }
  if (!text) return { ok: false, error: 'Comment is empty.' }
  if (text.length > 5000) return { ok: false, error: 'Comment is too long (max 5000 characters).' }

  const { data, error } = await adminClient()
    .from('prospect_comments')
    .insert({ email: key, body: text, author_id: user.id, author_name: user.name })
    .select('id, email, body, author_id, author_name, created_at')
    .single()

  if (error) return { ok: false, error: error.message }
  revalidateAdmissions()
  return { ok: true, comment: data as ProspectComment }
}

/** Delete a comment. Allowed for the author or any admin. */
export async function deleteProspectComment(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireStaff()
  let query = adminClient().from('prospect_comments').delete().eq('id', id)
  // Non-admins can only delete their own comments.
  if (user.role !== 'admin') query = query.eq('author_id', user.id)

  const { error } = await query
  if (error) return { ok: false, error: error.message }
  revalidateAdmissions()
  return { ok: true }
}

// ── Sync Website hits → Google Sheets ───────────────────────────────────────

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : '')

/**
 * Productised "Sync to Sheets" for the Website hits table. `learner_applications`
 * is the source of truth; only the columns below are written (matched by the
 * application id), so any extra columns the team keeps in the sheet are preserved.
 */
export async function syncWebsiteHitsToSheet(sheetUrl: string, sheetTab: string): Promise<SyncToSheetResult> {
  await requireStaff()

  const spreadsheetId = parseSpreadsheetId(sheetUrl)
  if (!spreadsheetId) return { ok: false, error: 'Could not read a Google Sheet ID from that link.' }

  const admin = adminClient()
  const [{ data: apps, error }, { data: prospects }] = await Promise.all([
    admin
      .from('learner_applications')
      .select('id, created_at, name, email, phone, college_name, educational_status, referral_source, referral_detail, signup_token, signed_up_at')
      .order('created_at', { ascending: false }),
    admin.from('prospects').select('email, signup_token'),
  ])
  if (error) return { ok: false, error: error.message }

  // Match each submission to a Pulse signup (token-first, email-fallback) so the
  // synced "Signed into Pulse" column mirrors the table.
  const index = buildProspectIndex(prospects ?? [])
  const rows = (apps ?? []).map((a) => ({ ...a, signed: matchSignup(a, index).matched }))

  try {
    const tab = sheetTab.trim() || (await getFirstTabName(spreadsheetId))
    const stats = await syncTableToSheet({
      spreadsheetId,
      sheetName: tab,
      rows,
      keyHeader: 'ID',
      key: (r) => r.id,
      columns: [
        { header: 'Submitted',          value: (r) => fmtDate(r.created_at) },
        { header: 'Name',               value: (r) => r.name },
        { header: 'Email',              value: (r) => r.email },
        { header: 'Phone',              value: (r) => r.phone },
        { header: 'College',            value: (r) => r.college_name },
        { header: 'Educational status', value: (r) => r.educational_status },
        { header: 'How did they hear?', value: (r) => r.referral_source },
        { header: 'Referral detail',    value: (r) => r.referral_detail },
        { header: 'Signed into Pulse',  value: (r) => (r.signed ? 'Yes' : 'No') },
      ],
    })
    return { ok: true, stats }
  } catch (e) {
    const msg = String((e as Error)?.message ?? e)
    if (/permission|PERMISSION_DENIED|403|does not have/i.test(msg))
      return { ok: false, error: 'Sync failed — make sure you shared the sheet with the service account as Editor.' }
    if (/parse range|not found|Requested entity/i.test(msg))
      return { ok: false, error: "Couldn't find that tab. Check the tab name, or leave it blank to use the first tab." }
    return { ok: false, error: msg }
  }
}
