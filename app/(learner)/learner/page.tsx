import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getEffectiveLearnerIdentity } from '@/lib/impersonation'
import LearnerDashboard from '@/components/learner/LearnerDashboard'
import { computeSnapshot, type ReasonEntry } from '@/lib/snapshot'
import { getApplyBlockReason } from '@/lib/learner/apply-eligibility'
import type { MyStatus } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LearnerDashboardPage() {
  const effective = await getEffectiveLearnerIdentity()
  if (!effective) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const [
    { data: roles },
    { data: companies },
    { data: applications },
    { data: preferences },
    { data: resumeCheck },
    { data: learnerRow },
  ] = await Promise.all([
    supabase
      .from('roles')
      .select('id, company_id, role_title, location, salary_range, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('companies').select('id, company_name, sort_order, created_at'),
    supabase
      .from('applications')
      .select('id, role_id, status, created_at, updated_at, not_shortlisted_reasons, not_shortlisted_reason, rejection_reasons, rejection_feedback')
      .eq('user_id', effective.userId),
    supabase
      .from('role_preferences')
      .select('role_id, preference, reasons, created_at')
      .eq('user_id', effective.userId),
    supabase.from('resumes').select('id').eq('user_id', effective.userId).limit(1),
    supabase.from('learners').select('status').eq('user_id', effective.userId).maybeSingle(),
  ])

  const learnerStatus = (learnerRow as unknown as { status: string | null } | null)?.status ?? null
  const blockReason   = getApplyBlockReason(learnerStatus)
  const isBlocked     = blockReason !== null

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
      applied_at: (a as unknown as { created_at: string | null }).created_at ?? null,
      updated_at: (a as unknown as { updated_at: string | null }).updated_at ?? null,
      not_shortlisted_reasons: (a.not_shortlisted_reasons as string[] | null) ?? [],
      not_shortlisted_reason:  (a.not_shortlisted_reason  as string | null) ?? null,
      rejection_reasons:       (a.rejection_reasons       as string[] | null) ?? [],
      rejection_feedback:      (a.rejection_feedback      as string | null) ?? null,
    }]),
  )
  const prefMap = Object.fromEntries(
    (preferences ?? []).map((p) => [p.role_id, p.preference]),
  )
  const prefReasonsMap = Object.fromEntries(
    (preferences ?? []).map((p) => [p.role_id, (p.reasons as string[] | null) ?? []]),
  )
  const prefAtMap = Object.fromEntries(
    (preferences ?? []).map((p) => [p.role_id, (p as unknown as { created_at: string | null }).created_at ?? null]),
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

      const postedAt = (role as unknown as { created_at: string | null }).created_at ?? null
      // Most recent action on this row, for "Recent activity" sort. App status
      // change wins; else NI mark time; else the role's posted date.
      const latestActivityAt =
        app?.updated_at ?? prefAtMap[role.id] ?? postedAt

      return {
        id: role.id,
        company_name: companyMap[role.company_id] ?? '',
        role_title: role.role_title,
        location: role.location,
        salary_range: role.salary_range as string | null,
        status: role.status as 'open' | 'closed',
        my_status: myStatus,
        posted_at: postedAt,
        applied_at: app?.applied_at ?? null,
        latest_activity_at: latestActivityAt,
        not_shortlisted_reasons: app?.not_shortlisted_reasons ?? [],
        not_shortlisted_reason:  app?.not_shortlisted_reason  ?? null,
        rejection_reasons:       app?.rejection_reasons       ?? [],
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
    .filter((a) => a.status === 'rejected')
    .filter((a) => {
      const reasons = (a.rejection_reasons as string[] | null) ?? []
      return reasons.length > 0 || (a.rejection_feedback as string | null)
    })
    .map((a) => {
      const reasons = (a.rejection_reasons as string[] | null) ?? []
      const comment = (a.rejection_feedback as string | null) ?? ''
      return {
        company: roleDetailMap[a.role_id]?.company_name ?? '',
        role:    roleDetailMap[a.role_id]?.role_title   ?? '',
        reason:  reasons.length > 0
          ? reasons.join(', ') + (comment ? ` — ${comment}` : '')
          : comment,
      }
    })

  const ignoredOpenCount = isBlocked
    ? 0
    : sortedRoles.filter(
        (r) => r.status === 'open' && r.my_status === 'not_applied',
      ).length

  const hasResume  = (resumeCheck ?? []).length > 0
  const firstName  = effective.name?.split(' ')[0] ?? 'there'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 @lg:max-w-6xl">
      <LearnerDashboard
        firstName={firstName}
        snapshot={snapshot}
        ignoredOpenCount={ignoredOpenCount}
        roles={sortedRoles}
        notShortlistedReasons={notShortlistedReasons}
        rejectedReasons={rejectedReasons}
        hasResume={hasResume}
        readOnly={effective.isImpersonating}
        blockReason={blockReason}
      />
    </div>
  )
}
