import { cache } from 'react'
import { createServerSupabaseClient } from './supabase-server'

export type AppUser = {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'LF' | 'learner'
}

export const getAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return null

  const { data } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('email', user.email)
    .single()

  return (data as AppUser) ?? null
})
