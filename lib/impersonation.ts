import { cookies } from 'next/headers'
import { getAppUser, type AppUser } from './auth'
import { createServerSupabaseClient } from './supabase-server'

const COOKIE_NAME = 'pulse_impersonate_user_id'

export type EffectiveLearnerIdentity = {
  userId:          string
  email:           string
  name:            string | null
  isImpersonating: boolean
  adminUser:       AppUser | null
}

/** Returns the impersonated user_id from the cookie, or null if not set. */
export async function getImpersonatedUserId(): Promise<string | null> {
  const c = await cookies()
  return c.get(COOKIE_NAME)?.value ?? null
}

/** Sets the impersonation cookie. Caller is responsible for permission checks. */
export async function setImpersonatedUserId(userId: string): Promise<void> {
  const c = await cookies()
  c.set(COOKIE_NAME, userId, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
  })
}

/** Clears the impersonation cookie. */
export async function clearImpersonatedUserId(): Promise<void> {
  const c = await cookies()
  c.delete(COOKIE_NAME)
}

/**
 * Returns the effective learner identity for the current request.
 * - Real learner: returns their own identity.
 * - Admin/staff with impersonation cookie: returns the impersonated learner.
 * - Anyone else: returns null.
 *
 * READS use this identity. WRITES are still gated by requireLearner() in
 * server actions, which rejects non-learners — so impersonators can read but
 * not write.
 */
export async function getEffectiveLearnerIdentity(): Promise<EffectiveLearnerIdentity | null> {
  const appUser = await getAppUser()
  if (!appUser) return null

  if (appUser.role === 'learner') {
    return {
      userId:          appUser.id,
      email:           appUser.email,
      name:            appUser.name,
      isImpersonating: false,
      adminUser:       null,
    }
  }

  if (appUser.role !== 'admin' && appUser.role !== 'staff') return null

  const impersonatedId = await getImpersonatedUserId()
  if (!impersonatedId) return null

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('users')
    .select('id, email, name, role')
    .eq('id', impersonatedId)
    .single()

  if (!data || data.role !== 'learner') return null

  return {
    userId:          data.id,
    email:           data.email,
    name:            data.name,
    isImpersonating: true,
    adminUser:       appUser,
  }
}
