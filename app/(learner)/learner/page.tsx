import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import RoleFeed from '@/components/learner/RoleFeed'
import type { MyStatus } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LearnerHomePage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const [
    { data: roles },
    { data: companies },
    { data: applications },
    { data: preferences },
  ] = await Promise.all([
    supabase
      .from('roles')
      .select('id, company_id, role_title, location, salary_range, status')
      .order('created_at', { ascending: false }),
    supabase.from('companies').select('id, company_name, sort_order, created_at'),
    supabase
      .from('applications')
      .select('id, role_id, status')
      .eq('user_id', appUser.id),
    supabase
      .from('role_preferences')
      .select('role_id, preference')
      .eq('user_id', appUser.id),
  ])

  const companyMap = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, c.company_name]),
  )
  // Build sort key per company: (sort_order ASC NULLS LAST, created_at ASC)
  // matches admin view's ORDER BY sort_order ASC NULLS LAST, created_at ASC
  const companyMetaMap = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, { order: c.sort_order ?? 9999, created: c.created_at as string }]),
  )
  const appMap = Object.fromEntries(
    (applications ?? []).map((a) => [a.role_id, { id: a.id, status: a.status }]),
  )
  const prefMap = Object.fromEntries(
    (preferences ?? []).map((p) => [p.role_id, p.preference]),
  )

  const roleList = [...(roles ?? [])].sort((a, b) => {
    const ma = companyMetaMap[a.company_id] ?? { order: 9999, created: '' }
    const mb = companyMetaMap[b.company_id] ?? { order: 9999, created: '' }
    const diff = ma.order - mb.order
    return diff !== 0 ? diff : ma.created.localeCompare(mb.created)
  }).map((role) => {
    const app = appMap[role.id]
    const pref = prefMap[role.id]

    let myStatus: MyStatus
    if (app) {
      myStatus = app.status as MyStatus
    } else if (pref === 'not_interested') {
      myStatus = 'not_interested'
    } else {
      myStatus = 'not_applied'
    }

    return {
      id: role.id,
      company_name: companyMap[role.company_id] ?? '',
      role_title: role.role_title,
      location: role.location,
      salary_range: role.salary_range as string | null,
      status: role.status as 'open' | 'closed',
      my_status: myStatus,
    }
  })

  const appliedCount = (applications ?? []).length
  const openCount    = roleList.filter((r) => r.status === 'open').length

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">
          Hey, {appUser.name?.split(' ')[0] ?? 'there'}!
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {openCount === 0
            ? 'No open roles right now.'
            : `${openCount} open role${openCount !== 1 ? 's' : ''} available`}
        </p>
      </div>

      {/* My Roles nudge banner */}
      <a
        href="/learner/my-roles"
        className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-white">
              <path fillRule="evenodd" d="M6 3.75A2.75 2.75 0 0 1 8.75 1h2.5A2.75 2.75 0 0 1 14 3.75v.443c.572.055 1.14.122 1.706.2C17.053 4.582 18 5.75 18 7.07v3.469c0 1.126-.694 2.191-1.83 2.54-1.952.599-4.024.921-6.17.921s-4.219-.322-6.17-.921C2.694 12.73 2 11.665 2 10.539V7.07c0-1.32.947-2.489 2.294-2.676A41.047 41.047 0 0 1 6 4.193V3.75Zm6.5 0v.325a41.622 41.622 0 0 0-5 0V3.75c0-.69.56-1.25 1.25-1.25h2.5c.69 0 1.25.56 1.25 1.25Zm-5 6.5a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1-.75-.75v-.008Zm4.5 0a.75.75 0 0 1 .75-.75h.008a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008Z" clipRule="evenodd" />
              <path d="M9.5 15.5h1a1 1 0 0 1 1 1v.5h1.5a.5.5 0 0 1 0 1h-9a.5.5 0 0 1 0-1H6v-.5a1 1 0 0 1 1-1h1v-3.171a5.977 5.977 0 0 1-1.812-.718L6 11.5l-.001.002A7.014 7.014 0 0 1 4 11.07V14.5H2.5a.5.5 0 0 1 0-1H4v-3.43A7.028 7.028 0 0 1 3 10.54v-.002l.188-.187c.207.096.42.18.638.253A5.975 5.975 0 0 0 5.5 11.5h9a5.975 5.975 0 0 0 1.674-.894c.219-.072.432-.157.638-.253L17 10.54v-.002a7.028 7.028 0 0 1-1 .43V14h1.5a.5.5 0 0 1 0 1H16v-3.43A7.014 7.014 0 0 1 14.001 11.5L14 11.188a5.977 5.977 0 0 1-1.812.718L12.5 15.5h-3Z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900">My Roles</p>
            <p className="text-xs text-zinc-500">
              {appliedCount === 0
                ? 'Apply to a role below and track your status here'
                : `You've applied to ${appliedCount} role${appliedCount !== 1 ? 's' : ''} — see your latest status`}
            </p>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
          <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </a>

      <RoleFeed roles={roleList} />
    </div>
  )
}
