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

export async function updateUser(
  id: string,
  data: { name: string; email: string; role: string },
): Promise<{ error?: string }> {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'admin') redirect('/dashboard')

  const email = data.email.trim().toLowerCase()
  const name = data.name.trim() || null

  const supabase = await createServerSupabaseClient()

  // Check email uniqueness against other users
  const { data: conflict } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .neq('id', id)
    .maybeSingle()

  if (conflict) return { error: 'Email already in use by another user' }

  const { error } = await supabase
    .from('users')
    .update({ name, email, role: data.role })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/users')
  return {}
}

export async function deleteUser(id: string): Promise<{ error?: string }> {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'admin') redirect('/dashboard')

  if (appUser.id === id) return { error: 'You cannot delete your own account.' }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.from('users').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/users')
  return {}
}
