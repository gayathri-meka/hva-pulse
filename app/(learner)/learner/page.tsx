import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LearnerDashboard from '@/components/learner/LearnerDashboard'
import type { MyStatus } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LearnerDashboardPage() {
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
      .select('role_id, preference, reasons')
      .eq('user_id', appUser.id),
  ])

  const companyMap = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, c.company_name]),
  )
  const companyMetaMap = Object.fromEntries(
    (companies ?? []).map((c) => [
      c.id,
      { order: c.sort_order ?? 9999, created: c.created_at as string },
    ]),
  )
  const appMap = Object.fromEntries(
    (applications ?? []).map((a) => [a.role_id, { id: a.id, status: a.status }]),
  )
  const prefMap = Object.fromEntries(
    (preferences ?? []).map((p) => [p.role_id, p.preference]),
  )

  // Build role list sorted by company order, then split open-first
  const roleList = [...(roles ?? [])]
    .sort((a, b) => {
      const ma = companyMetaMap[a.company_id] ?? { order: 9999, created: '' }
      const mb = companyMetaMap[b.company_id] ?? { order: 9999, created: '' }
      const diff = ma.order - mb.order
      return diff !== 0 ? diff : ma.created.localeCompare(mb.created)
    })
    .map((role) => {
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

  // Open roles first, closed below (preserve company sort within each group)
  const sortedRoles = [
    ...roleList.filter((r) => r.status === 'open'),
    ...roleList.filter((r) => r.status === 'closed'),
  ]

  // Snapshot stats
  const appList = applications ?? []
  const niList = (preferences ?? []).filter((p) => p.preference === 'not_interested')

  const total            = roleList.length
  const appliedCount     = appList.length
  const notInterestedCount = niList.length
  const ignoredCount     = total - appliedCount - notInterestedCount
  const ignoredOpenCount = sortedRoles.filter(
    (r) => r.status === 'open' && r.my_status === 'not_applied',
  ).length

  const shortlistedCount    = appList.filter((a) => a.status === 'shortlisted').length
  const notShortlistedCount = appList.filter((a) => a.status === 'not_shortlisted').length
  const rejectedCount       = appList.filter((a) => a.status === 'rejected').length
  const hiredCount          = appList.filter((a) => a.status === 'hired').length
  const pendingCount        = appList.filter((a) => a.status === 'applied').length

  const applicationRate = total > 0 ? Math.round((appliedCount / total) * 100) : 0

  // Aggregate not-interested reasons for the expand breakdown
  const allReasons = niList.flatMap((p) => (p as { reasons?: string[] }).reasons ?? [])
  const reasonCounts: Record<string, number> = {}
  allReasons.forEach((r) => {
    reasonCounts[r] = (reasonCounts[r] ?? 0) + 1
  })

  const firstName = appUser.name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <LearnerDashboard
        firstName={firstName}
        snapshot={{
          total,
          applied:        appliedCount,
          notInterested:  notInterestedCount,
          ignored:        ignoredCount,
          shortlisted:    shortlistedCount,
          notShortlisted: notShortlistedCount,
          rejected:       rejectedCount,
          hired:          hiredCount,
          pending:        pendingCount,
          applicationRate,
          reasonCounts,
        }}
        ignoredOpenCount={ignoredOpenCount}
        roles={sortedRoles}
      />
    </div>
  )
}
