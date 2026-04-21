import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import { PermissionsProvider } from '@/components/PermissionsContext'
import type { Notification } from '@/components/notifications/NotificationBell'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appUser = await getAppUser()

  if (!appUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6 text-red-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-zinc-900">Access Denied</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your account is not approved. Contact an administrator.
          </p>
        </div>
      </div>
    )
  }

  // Learner has their own route group — send them there
  if (appUser.role === 'learner') redirect('/learner')

  const supabase = await createServerSupabaseClient()
  const { data: notificationsRaw } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications: Notification[] = (notificationsRaw ?? []) as Notification[]

  return (
    <PermissionsProvider role={appUser.role}>
      <AppShell role={appUser.role} notifications={notifications}>{children}</AppShell>
    </PermissionsProvider>
  )
}
