'use server'

import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { setImpersonatedUserId, clearImpersonatedUserId } from '@/lib/impersonation'

export async function startImpersonation(userId: string) {
  await requireStaff()

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (!data || data.role !== 'learner') {
    throw new Error('User is not a learner')
  }

  await setImpersonatedUserId(userId)
  redirect('/learner')
}

export async function exitImpersonation() {
  await clearImpersonatedUserId()
  redirect('/learner-view')
}
