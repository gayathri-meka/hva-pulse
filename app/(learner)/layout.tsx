import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import LearnerShell from '@/components/learner/LearnerShell'

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'learner') redirect('/dashboard')

  return <LearnerShell>{children}</LearnerShell>
}
