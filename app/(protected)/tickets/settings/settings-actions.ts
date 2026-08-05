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
// Sort order is NOT hand-entered — a new category is appended at the end, and order is changed via
// moveCategory (↑/↓), which keeps it a clean contiguous 1..N. So this only handles name/SPOCs/active.
export async function saveCategory(input: {
  id?: string
  name: string
  spoc_emails: string[]
  active: boolean
}): Promise<Result> {
  await requireAdmin()
  const name = input.name.trim()
  if (!name) return { ok: false, error: 'Name is required.' }

  const supabase = await createServerSupabaseClient()
  const spoc_emails = input.spoc_emails.map((e) => e.trim().toLowerCase()).filter(Boolean)

  if (input.id) {
    const { error } = await supabase
      .from('ticket_categories')
      .update({ name, spoc_emails, active: input.active, updated_at: new Date().toISOString() })
      .eq('id', input.id)
    if (error) return { ok: false, error: error.message }
  } else {
    const { data: last } = await supabase
      .from('ticket_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const nextOrder = (last?.sort_order ?? 0) + 1
    const { error } = await supabase
      .from('ticket_categories')
      .insert({ name, spoc_emails, active: input.active, sort_order: nextOrder })
    if (error) return { ok: false, error: error.message }
  }
  revalidate()
  return { ok: true }
}

// Moves a category up/down and renumbers ALL categories to a clean, gap-free 1..N.
export async function moveCategory(id: string, direction: 'up' | 'down'): Promise<Result> {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { data: cats } = await supabase.from('ticket_categories').select('id').order('sort_order', { ascending: true })
  if (!cats) return { ok: false, error: 'Could not load categories.' }

  const idx = cats.findIndex((c) => c.id === id)
  if (idx < 0) return { ok: false, error: 'Category not found.' }
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= cats.length) return { ok: true } // already at the edge — no-op

  const order = cats.map((c) => c.id)
  ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]

  // Renumber 1..N (normalises any pre-existing gaps).
  for (let i = 0; i < order.length; i++) {
    const { error } = await supabase
      .from('ticket_categories')
      .update({ sort_order: i + 1, updated_at: new Date().toISOString() })
      .eq('id', order[i])
    if (error) return { ok: false, error: error.message }
  }
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
