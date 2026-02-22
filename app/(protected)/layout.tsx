import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import AppShell from '@/components/AppShell'
import { signOut } from '@/app/actions'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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

  // Learner portal is under construction — block access gracefully
  if (appUser.role === 'learner') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm max-w-sm w-full">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6 text-amber-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-zinc-900">Coming soon</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your learner dashboard is being built. Check back soon.
          </p>
          <form action={signOut} className="mt-6">
            <button
              type="submit"
              className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <AppShell role={appUser.role}>{children}</AppShell>
}
