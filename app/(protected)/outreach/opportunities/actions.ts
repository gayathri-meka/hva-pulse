'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

async function requireAdmin() {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'admin') redirect('/dashboard')
  return appUser
}

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
