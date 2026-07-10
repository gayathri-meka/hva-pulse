import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getAppUser } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import { PermissionsProvider } from '@/components/PermissionsContext'
import GlobalNavigationLoader from '@/components/GlobalNavigationLoader'
import InterviewerHeader from '@/components/interviewer/InterviewerHeader'

// The one page a dedicated interviewer may see (their scheduling calendar).
const INTERVIEWER_HOME = '/admissions/interviews/calendar'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appUser = await getAppUser()

  if (!appUser) redirect('/candidate/welcome')

  // Learner has their own route group — send them there
  if (appUser.role === 'learner') redirect('/learner')

  // Dedicated interviewers are scoped to just the scheduling calendar (under
  // Admissions), with minimal chrome — no sidebar, no other tabs.
  if (appUser.role === 'interviewer') {
    const path = (await headers()).get('x-pathname') ?? ''
    if (!path.startsWith(INTERVIEWER_HOME)) redirect(INTERVIEWER_HOME)
    return (
      <div className="min-h-screen bg-zinc-50">
        <InterviewerHeader name={appUser.name ?? appUser.email} />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    )
  }

  return (
    <PermissionsProvider role={appUser.role}>
      <GlobalNavigationLoader>
        <AppShell role={appUser.role}>{children}</AppShell>
      </GlobalNavigationLoader>
    </PermissionsProvider>
  )
}
