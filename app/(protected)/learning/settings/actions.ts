'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { getAppUser } from '@/lib/auth'

async function requireAdmin() {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') throw new Error('Admin only')
  return user
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function saveLearningSettings(key: string, value: unknown) {
  await requireAdmin()
  const supabase = adminClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
  revalidatePath('/learning/settings')
  revalidatePath('/learning')
}
