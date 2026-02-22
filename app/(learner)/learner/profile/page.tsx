import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ResumeManager from '@/components/learner/ResumeManager'
import { signOut } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const { data: resumes } = await supabase
    .from('resumes')
    .select('id, version_name, file_url, created_at')
    .eq('user_id', appUser.id)
    .order('created_at', { ascending: false })

  const initials = (appUser.name ?? appUser.email)[0].toUpperCase()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Profile</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            Sign out
          </button>
        </form>
      </div>

      {/* Identity card */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-zinc-900">{appUser.name ?? '—'}</p>
          <p className="truncate text-xs text-zinc-400">{appUser.email}</p>
        </div>
      </div>

      {/* Resume management */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-700">Resumes</h2>
        <ResumeManager resumes={resumes ?? []} />
      </div>
    </div>
  )
}
