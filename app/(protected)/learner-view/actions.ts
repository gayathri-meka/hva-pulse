'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireStaff } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  setImpersonatedUserId,
  clearImpersonatedUserId,
  setPreviewMode,
  type PreviewMode,
} from '@/lib/impersonation'

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
  // Default to mobile preview when entering learner-view
  await setPreviewMode('mobile')
  redirect('/learner')
}

export async function togglePreviewMode(mode: PreviewMode) {
  await requireStaff()
  await setPreviewMode(mode)
  revalidatePath('/learner')
  revalidatePath('/learner/profile')
}

export async function exitImpersonation() {
  await clearImpersonatedUserId()
  redirect('/learner-view')
}
