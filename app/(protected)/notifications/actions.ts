'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

export async function markNotificationRead(id: string) {
  const user = await getAppUser()
  if (!user) throw new Error('Not authenticated')
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}

export async function markAllNotificationsRead() {
  const user = await getAppUser()
  if (!user) throw new Error('Not authenticated')
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
}
