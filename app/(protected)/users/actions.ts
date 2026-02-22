'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

export async function addUser(formData: FormData) {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'admin') redirect('/dashboard')

  const email = (formData.get('email') as string).trim().toLowerCase()
  const name  = (formData.get('name') as string).trim()
  const role  = formData.get('role') as string

  const supabase = await createServerSupabaseClient()

  const { data: existing } = await supabase
    .from('users')
    .select('email')
    .eq('email', email)
    .single()

  if (existing) {
    redirect('/users?error=User+already+exists')
  }

  await supabase.from('users').insert({ email, name: name || null, role })
  revalidatePath('/users')
}

export async function updateUserRole(id: string, role: string) {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'admin') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()
  await supabase.from('users').update({ role }).eq('id', id)
  revalidatePath('/users')
}
