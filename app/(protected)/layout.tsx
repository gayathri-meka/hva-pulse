import { redirect } from 'next/navigation'
import { getAppUser, canSeePII } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AppShell from '@/components/AppShell'
import { PermissionsProvider } from '@/components/PermissionsContext'
import type { Notification } from '@/components/notifications/NotificationBell'
import { computeActionItemNotifications } from '@/lib/learning/action-item-notifications'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const appUser = await getAppUser()

  if (!appUser) redirect('/coming-soon')

  // Learner has their own route group — send them there
  if (appUser.role === 'learner') redirect('/learner')

  const supabase = await createServerSupabaseClient()
  const showPII  = canSeePII(appUser.role)

  const [{ data: notificationsRaw }, actionItemNotifications] = await Promise.all([
    supabase
      .from('notifications')
      .select('id, type, title, body, link, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(50),
    computeActionItemNotifications(supabase, showPII),
  ])

  // Synthesized action-item notifications first (sorted by urgency), then persisted history.
  const notifications: Notification[] = [
    ...actionItemNotifications,
    ...((notificationsRaw ?? []) as Notification[]),
  ]

  return (
    <PermissionsProvider role={appUser.role}>
      <AppShell role={appUser.role} notifications={notifications}>{children}</AppShell>
    </PermissionsProvider>
  )
}
