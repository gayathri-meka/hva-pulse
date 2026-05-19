import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import { getEffectiveLearnerIdentity } from '@/lib/impersonation'
import LearnerShell from '@/components/learner/LearnerShell'
import ImpersonationBanner from '@/components/learner-view/ImpersonationBanner'

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const effective = await getEffectiveLearnerIdentity()
  if (!effective) redirect('/dashboard')

  return (
    <>
      {effective.isImpersonating && (
        <ImpersonationBanner learnerName={effective.name ?? effective.email} />
      )}
      <LearnerShell>{children}</LearnerShell>
    </>
  )
}
