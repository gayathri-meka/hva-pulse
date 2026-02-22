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
            className="text-xs font-medium text-zinc-400 hover:text-zinc-700 transition-colors"
          >
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
