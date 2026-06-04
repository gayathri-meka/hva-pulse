import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import { PermissionsProvider } from '@/components/PermissionsContext'
import GlobalNavigationLoader from '@/components/GlobalNavigationLoader'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appUser = await getAppUser()

  if (!appUser) redirect('/candidate/welcome')

  // Learner has their own route group — send them there
  if (appUser.role === 'learner') redirect('/learner')

  return (
    <PermissionsProvider role={appUser.role}>
      <GlobalNavigationLoader>
        <AppShell role={appUser.role}>{children}</AppShell>
      </GlobalNavigationLoader>
    </PermissionsProvider>
  )
}
