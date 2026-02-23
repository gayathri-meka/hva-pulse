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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">
          Hey, {appUser.name?.split(' ')[0] ?? 'there'}!
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {roleList.filter((r) => r.status === 'open').length === 0
            ? 'No open roles right now.'
            : `There ${roleList.filter((r) => r.status === 'open').length === 1 ? 'is' : 'are'} ${roleList.filter((r) => r.status === 'open').length} open role${roleList.filter((r) => r.status === 'open').length !== 1 ? 's' : ''} available`}
        </p>
      </div>

      <RoleFeed roles={roleList} />
    </div>
  )
}
