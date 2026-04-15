import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from './supabase-server'

export type AppUser = {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'staff' | 'guest' | 'learner'
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

/** Throws/redirects if the current user is not admin or staff. Returns the user. */
export async function requireStaff(): Promise<AppUser> {
  const appUser = await getAppUser()
  if (!appUser || (appUser.role !== 'admin' && appUser.role !== 'staff')) {
    redirect('/dashboard')
  }
  return appUser
}

/** Returns true if this role can make changes. Guest is read-only. */
export function canEdit(role: AppUser['role']): boolean {
  return role === 'admin' || role === 'staff'
}

/** Returns true if this role should see PII. Guest sees masked data. */
export function canSeePII(role: AppUser['role']): boolean {
  return role !== 'guest'
}
