'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function updateLF(id: number, name: string, email: string) {
  const supabase = await createServerSupabaseClient()
  await supabase.from('lfs').update({ name, email }).eq('id', id)
  revalidatePath('/lfs')
}
