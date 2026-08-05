'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

// Category management. Admin-only. Because the edge builds the /tech-support Slack modal + assigns
// SPOCs FROM ticket_categories at request time, edits here take effect immediately with no edge
// redeploy. SPOCs are the app's admin/staff users (public.users) — managed on the Users page, not
// here — so a category just stores the assigned users' emails.

type Result = { ok: boolean; error?: string }

async function requireAdmin() {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') redirect('/dashboard')
  return user
}

function revalidate() {
  revalidatePath('/tickets')
  revalidatePath('/tickets/settings')
}

// ── Categories ──────────────────────────────────────────────────────────────────
export async function saveCategory(input: {
  id?: string
  name: string
  spoc_emails: string[]
  sort_order: number
  active: boolean
}): Promise<Result> {
  await requireAdmin()
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required.' }

  const supabase = await createServerSupabaseClient()

  // Reject a duplicate sort_order (defence in depth — the modal validates this client-side too).
  const dupeQuery = supabase.from('ticket_categories').select('id').eq('sort_order', input.sort_order)
  const { data: dupe } = await (input.id ? dupeQuery.neq('id', input.id) : dupeQuery).maybeSingle()
  if (dupe) return { ok: false, error: `Sort order ${input.sort_order} is already used by another category.` }

  const spoc_emails = input.spoc_emails.map((e) => e.trim().toLowerCase()).filter(Boolean)
  const row = { name, spoc_emails, sort_order: input.sort_order, active: input.active, updated_at: new Date().toISOString() }

  const { error } = input.id
    ? await supabase.from('ticket_categories').update(row).eq('id', input.id)
    : await supabase.from('ticket_categories').insert(row)

  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}

export async function deleteCategory(id: string): Promise<Result> {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('ticket_categories').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidate()
  return { ok: true }
}
