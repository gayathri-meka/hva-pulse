'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/auth'
import { normEmail, type ProspectComment } from '@/lib/prospectComments'

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
