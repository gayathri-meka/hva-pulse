'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getAppUser } from '@/lib/auth'
import { disconnectAccount } from '@/lib/googleMail'

async function requireAdmin() {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') redirect('/dashboard')
  return user
}

/** Disconnect the shared Google email-sending account (admin only). */
export async function disconnectEmailAccount(): Promise<{ ok: true }> {
  await requireAdmin()
  await disconnectAccount()
  revalidatePath('/settings/email')
  return { ok: true }
}
