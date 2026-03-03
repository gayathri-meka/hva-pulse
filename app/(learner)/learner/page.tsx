import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LearnerDashboard from '@/components/learner/LearnerDashboard'
import { computeSnapshot, type ReasonEntry } from '@/lib/snapshot'
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
    { data: resumeCheck },
  ] = await Promise.all([
    supabase
      .from('roles')
      .select('id, company_id, role_title, location, salary_range, status')
      .order('created_at', { ascending: false }),
    supabase.from('companies').select('id, company_name, sort_order, created_at'),
    supabase
      .from('applications')
      .select('id, role_id, status, not_shortlisted_reasons, not_shortlisted_reason, rejection_feedback')
      .eq('user_id', appUser.id),
    supabase
      .from('role_preferences')
      .select('role_id, preference, reasons')
      .eq('user_id', appUser.id),
    supabase.from('resumes').select('id').eq('user_id', appUser.id).limit(1),
  ])

  const companyMap = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, c.company_name]),
  )
  const roleDetailMap = Object.fromEntries(
    (roles ?? []).map((r) => [r.id, { company_name: companyMap[r.company_id] ?? '', role_title: r.role_title }]),
  )
  const companyMetaMap = Object.fromEntries(
    (companies ?? []).map((c) => [
      c.id,
      { order: c.sort_order ?? 9999, created: c.created_at as string },
    ]),
  )
  const appMap = Object.fromEntries(
    (applications ?? []).map((a) => [a.role_id, {
      id: a.id,
      status: a.status,
      not_shortlisted_reasons: (a.not_shortlisted_reasons as string[] | null) ?? [],
      not_shortlisted_reason:  (a.not_shortlisted_reason  as string | null) ?? null,
      rejection_feedback:      (a.rejection_feedback      as string | null) ?? null,
    }]),
  )
  const prefMap = Object.fromEntries(
    (preferences ?? []).map((p) => [p.role_id, p.preference]),
  )
  const prefReasonsMap = Object.fromEntries(
    (preferences ?? []).map((p) => [p.role_id, (p.reasons as string[] | null) ?? []]),
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
      const app  = appMap[role.id]
      const pref = prefMap[role.id]
      const niReasons = prefReasonsMap[role.id] ?? []

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
        not_shortlisted_reasons: app?.not_shortlisted_reasons ?? [],
        not_shortlisted_reason:  app?.not_shortlisted_reason  ?? null,
        rejection_feedback:      app?.rejection_feedback      ?? null,
        not_interested_reasons: niReasons,
      }
    })

  // Open roles first, closed below (preserve company sort within each group)
  const sortedRoles = [
    ...roleList.filter((r) => r.status === 'open'),
    ...roleList.filter((r) => r.status === 'closed'),
  ]

  const snapshot = computeSnapshot(roleList.length, applications ?? [], preferences ?? [])

  const notShortlistedReasons: ReasonEntry[] = (applications ?? [])
    .filter((a) => a.status === 'not_shortlisted')
    .filter((a) => {
      const reasons = (a.not_shortlisted_reasons as string[] | null) ?? []
      return reasons.length > 0 || (a.not_shortlisted_reason as string | null)
    })
    .map((a) => {
      const reasons = (a.not_shortlisted_reasons as string[] | null) ?? []
      const comment = (a.not_shortlisted_reason as string | null) ?? ''
      return {
        company: roleDetailMap[a.role_id]?.company_name ?? '',
        role:    roleDetailMap[a.role_id]?.role_title   ?? '',
        reason:  reasons.length > 0
          ? reasons.join(', ') + (comment ? ` — ${comment}` : '')
          : comment,
      }
    })

  const rejectedReasons: ReasonEntry[] = (applications ?? [])
    .filter((a) => a.status === 'rejected' && (a.rejection_feedback as string | null))
    .map((a) => ({
      company: roleDetailMap[a.role_id]?.company_name ?? '',
      role:    roleDetailMap[a.role_id]?.role_title   ?? '',
      reason:  a.rejection_feedback as string,
    }))

  const ignoredOpenCount = sortedRoles.filter(
    (r) => r.status === 'open' && r.my_status === 'not_applied',
  ).length

  const hasResume  = (resumeCheck ?? []).length > 0
  const firstName  = appUser.name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <LearnerDashboard
        firstName={firstName}
        snapshot={snapshot}
        ignoredOpenCount={ignoredOpenCount}
        roles={sortedRoles}
        notShortlistedReasons={notShortlistedReasons}
        rejectedReasons={rejectedReasons}
        hasResume={hasResume}
      />
    </div>
  )
}
