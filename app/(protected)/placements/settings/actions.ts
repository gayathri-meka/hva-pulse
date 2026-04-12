'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

async function requireAdmin() {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') throw new Error('Admin only')
  return user
}

export async function savePlacementSetting(key: string, value: unknown) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath('/placements/settings')
  revalidatePath('/placements/analytics')
  revalidatePath('/placements/matching')
  revalidatePath('/placements/applications')
}
