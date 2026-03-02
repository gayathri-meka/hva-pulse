'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'

const requireAdmin = requireStaff

export async function updateOpportunityStatus(id: string, status: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_opportunities').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/outreach/opportunities')
}

export async function updateOpportunityNotes(id: string, notes: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_opportunities').update({ notes: notes || null, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/outreach/opportunities')
}

export async function deleteOpportunity(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_opportunities').delete().eq('id', id)
  revalidatePath('/outreach/opportunities')
}
