import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import MatchingControls from '@/components/placements/MatchingControls'
import MatchingStatusFilter from '@/components/placements/MatchingStatusFilter'
import MatchingTable, { type MatchingRow, type MatchingStatus, type AppDetail } from '@/components/placements/MatchingTable'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ role?: string; status?: string; learner?: string }>
}

export default async function MatchingPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'staff' && appUser.role !== 'guest') redirect('/dashboard')

  const { role: roleId, status: statusFilter, learner: learnerFilter } = await searchParams

  const supabase = await createServerSupabaseClient()

  const [
    { data: roles },
    { data: companies },
    { data: rawLearners },
    { data: rawApplications },
    { data: rawPreferences },
    { data: allAppsRaw },
    { data: allPrefsRaw },
    { data: nsRow },
    { data: rejRow },
  ] = await Promise.all([
    supabase.from('roles').select('id, company_id, role_title, status').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, company_name'),
    supabase.from('learners').select('*, users!learners_user_id_fkey(name, email)'),
    roleId
      ? supabase.from('applications').select('id, user_id, status, not_shortlisted_reason, not_shortlisted_reasons, rejection_feedback, rejection_reasons').eq('role_id', roleId)
      : Promise.resolve({ data: null, error: null }),
    roleId
      ? supabase.from('role_preferences').select('user_id, reasons').eq('role_id', roleId).eq('preference', 'not_interested')
      : Promise.resolve({ data: null, error: null }),
    // Cross-role: all applications for aggregate columns
    supabase.from('applications').select('user_id, role_id, status, not_shortlisted_reason, not_shortlisted_reasons, rejection_feedback, rejection_reasons'),
    // Cross-role: all not-interested preferences
    supabase.from('role_preferences').select('user_id, role_id, reasons').eq('preference', 'not_interested'),
    // Configurable reasons from settings
    supabase.from('settings').select('value').eq('key', 'ns_reasons').maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'rejection_reasons').maybeSingle(),
  ])

  // ── Build role options for dropdown ──────────────────────────────────────────
  const companyMap = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, c.company_name])
  )
  const roleOptions = (roles ?? [])
    .map((r) => ({
      id:           r.id,
      role_title:   r.role_title,
      company_name: companyMap[r.company_id] ?? '',
      status:       r.status,
    }))
    .sort((a, b) =>
      a.company_name.localeCompare(b.company_name) ||
      a.role_title.localeCompare(b.role_title)
    )

  // ── Build cross-role aggregates per user_id ─────────────────────────────────
  const roleMap = Object.fromEntries(
    (roles ?? []).map((r) => [r.id, { role_title: r.role_title, company_name: companyMap[r.company_id] ?? '' }])
  )

  type CrossAppRow = { user_id: string; role_id: string; status: string; not_shortlisted_reason: string | null; not_shortlisted_reasons: string[]; rejection_feedback: string | null; rejection_reasons: string[] }
  const allApps = (allAppsRaw ?? []) as CrossAppRow[]

  // Group apps by user_id
  const appsByUser = new Map<string, CrossAppRow[]>()
  for (const a of allApps) {
    if (!a.user_id) continue
    if (!appsByUser.has(a.user_id)) appsByUser.set(a.user_id, [])
    appsByUser.get(a.user_id)!.push(a)
  }

  // Group not-interested prefs by user_id
  type CrossPrefRow = { user_id: string; role_id: string; reasons: string[] }
  const allPrefs = (allPrefsRaw ?? []) as CrossPrefRow[]
  const prefsByUser = new Map<string, CrossPrefRow[]>()
  for (const p of allPrefs) {
    if (!p.user_id) continue
    if (!prefsByUser.has(p.user_id)) prefsByUser.set(p.user_id, [])
    prefsByUser.get(p.user_id)!.push(p)
  }

  function buildCrossRoleFields(userId: string | null) {
    if (!userId) return {
      applied_count: 0, applied_details: [],
      not_interested_count: 0, not_interested_details: [],
      not_shortlisted_count: 0, not_shortlisted_details: [],
      ongoing_count: 0, ongoing_details: [],
      rejected_count: 0, rejected_details: [],
      feedback_details: [],
    }

    const apps = appsByUser.get(userId) ?? []
    const prefs = prefsByUser.get(userId) ?? []

    const toDetail = (a: CrossAppRow): AppDetail => {
      const r = roleMap[a.role_id]
      return {
        company:  r?.company_name ?? '—',
        role:     r?.role_title ?? '—',
        status:   a.status,
        feedback: a.status === 'not_shortlisted' ? a.not_shortlisted_reason : a.status === 'rejected' ? a.rejection_feedback : null,
        reasons:  a.status === 'not_shortlisted' ? (a.not_shortlisted_reasons ?? []) : a.status === 'rejected' ? (a.rejection_reasons ?? []) : [],
      }
    }

    const applied_details         = apps.map(toDetail)
    const not_shortlisted_details = apps.filter((a) => a.status === 'not_shortlisted').map(toDetail)
    const ongoing_details         = apps.filter((a) => a.status === 'interviews_ongoing').map(toDetail)
    const rejected_details        = apps.filter((a) => a.status === 'rejected').map(toDetail)
    const feedback_details        = apps
      .filter((a) => (a.status === 'not_shortlisted' || a.status === 'rejected') && (a.not_shortlisted_reason || a.rejection_feedback || (a.not_shortlisted_reasons?.length ?? 0) > 0 || (a.rejection_reasons?.length ?? 0) > 0))
      .map(toDetail)

    const not_interested_details = prefs.map((p) => {
      const r = roleMap[p.role_id]
      return { company: r?.company_name ?? '—', role: r?.role_title ?? '—', reasons: p.reasons ?? [] }
    })

    return {
      applied_count:           applied_details.length,
      applied_details,
      not_interested_count:    not_interested_details.length,
      not_interested_details,
      not_shortlisted_count:   not_shortlisted_details.length,
      not_shortlisted_details,
      ongoing_count:           ongoing_details.length,
      ongoing_details,
      rejected_count:          rejected_details.length,
      rejected_details,
      feedback_details,
    }
  }

  // ── Flatten learners (join with users) ────────────────────────────────────
  type RawLearner = {
    learner_id:         string
    user_id:            string | null
    lf_name:            string
    batch_name:         string
    users:              { name: string; email: string } | null
    year_of_graduation: number | null
    degree:             string | null
    specialisation:     string | null
    prs:                number | null
    proactiveness:      number | null
    articulation:       number | null
    comprehension:      number | null
    tech_score:         number | null
    current_location:   string | null
    readiness:          string | null
    blacklisted_date:   string | null
    new_lf:             string | null
    new_batch:          string | null
  }
  const allLearners = ((rawLearners ?? []) as RawLearner[]).map((l) => ({
    learner_id:         l.learner_id,
    user_id:            l.user_id,
    name:               l.users?.name ?? '',
    batch:              l.batch_name ?? '',
    lf:                 l.lf_name ?? '',
    sub_cohort:         (l as unknown as { sub_cohort: string | null }).sub_cohort ?? null,
    learner_status:     (l as unknown as { status: string | null }).status ?? null,
    new_lf:             l.new_lf ?? null,
    new_batch:          l.new_batch ?? null,
    year_of_graduation: l.year_of_graduation,
    degree:             l.degree,
    specialisation:     l.specialisation,
    prs:                l.prs,
    proactiveness:      l.proactiveness,
    articulation:       l.articulation,
    comprehension:      l.comprehension,
    tech_score:         l.tech_score,
    current_location:   l.current_location,
    readiness:          l.readiness,
    blacklisted_date:   l.blacklisted_date,
  }))

  // ── Apply learner filter (server-side; batch/LF handled by column filters) ─
  const filtered = allLearners
    .filter((l) => !learnerFilter || l.learner_id === learnerFilter)
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Sub-cohort options ───────────────────────────────────────────────────
  const subCohortOptions = Array.from(
    new Set(((rawLearners ?? []) as { sub_cohort: string | null }[]).map((l) => l.sub_cohort).filter(Boolean))
  ).sort() as string[]

  // ── Derive placement status per learner ──────────────────────────────────
  // Map user_id → { status, not_shortlisted_reason, rejection_feedback }
  const appMap = Object.fromEntries(
    (rawApplications ?? [])
      .filter((a) => a.user_id)
      .map((a) => [a.user_id!, {
        id:                      a.id as string,
        status:                  a.status as MatchingStatus,
        not_shortlisted_reason:  (a.not_shortlisted_reason  as string | null)   ?? null,
        not_shortlisted_reasons: (a.not_shortlisted_reasons as string[] | null) ?? [],
        rejection_feedback:      (a.rejection_feedback      as string | null)   ?? null,
        rejection_reasons:       (a.rejection_reasons       as string[] | null) ?? [],
      }])
  )
  // Set of user_ids who marked not_interested + their reasons
  const notInterestedSet = new Set(
    (rawPreferences ?? []).map((p) => p.user_id).filter(Boolean)
  )
  const reasonsMap = Object.fromEntries(
    (rawPreferences ?? [])
      .filter((p) => p.user_id)
      .map((p) => [p.user_id!, (p.reasons as string[]) ?? []])
  )

  const sharedLearnerFields = (l: typeof filtered[number]) => ({
    year_of_graduation: l.year_of_graduation,
    degree:             l.degree,
    specialisation:     l.specialisation,
    prs_score:          l.prs,
    proactiveness:      l.proactiveness,
    articulation:       l.articulation,
    comprehension:      l.comprehension,
    tech_score:         l.tech_score,
    current_location:   l.current_location,
    readiness:          l.readiness,
    is_blacklisted:     (l.blacklisted_date !== null ? 'Yes' : 'No') as 'Yes' | 'No',
    blacklisted_date:   l.blacklisted_date,
    new_lf:             l.new_lf,
    new_batch:          l.new_batch,
  })

  const rows: MatchingRow[] = filtered.map((l) => {
    const crossRole = buildCrossRoleFields(l.user_id)
    if (!roleId) {
      return {
        learner_id:              l.learner_id,
        name:                    l.name,
        batch:                   l.batch,
        lf:                      l.lf,
        sub_cohort:              l.sub_cohort,
        learner_status:          l.learner_status,
        ...sharedLearnerFields(l),
        app_id:                  null,
        status:                  'not_applied' as MatchingStatus,
        reasons:                 [],
        not_shortlisted_reason:  null,
        not_shortlisted_reasons: [],
        rejection_feedback:      null,
        rejection_reasons:       [],
        ...crossRole,
      }
    }
    let status: MatchingStatus
    const appDetail = l.user_id ? appMap[l.user_id] : undefined
    if (appDetail) {
      status = appDetail.status
    } else if (l.user_id && notInterestedSet.has(l.user_id)) {
      status = 'not_interested'
    } else {
      status = 'not_applied'
    }
    return {
      learner_id:              l.learner_id,
      name:                    l.name,
      batch:                   l.batch,
      lf:                      l.lf,
      sub_cohort:              l.sub_cohort,
      learner_status:          l.learner_status,
      ...sharedLearnerFields(l),
      app_id:                  appDetail?.id ?? null,
      status,
      reasons:                 status === 'not_interested' && l.user_id ? (reasonsMap[l.user_id] ?? []) : [],
      not_shortlisted_reason:  appDetail?.not_shortlisted_reason  ?? null,
      not_shortlisted_reasons: appDetail?.not_shortlisted_reasons ?? [],
      rejection_feedback:      appDetail?.rejection_feedback      ?? null,
      rejection_reasons:       appDetail?.rejection_reasons       ?? [],
      ...crossRole,
    }
  })

  // ── Status counts (before status filter, for pill labels) ────────────────
  const statusCounts = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const filteredRows = statusFilter
    ? rows.filter((r) => r.status === statusFilter)
    : rows

  return (
    <div className="space-y-6">

      <Suspense>
        <MatchingControls
          roles={roleOptions}
          learners={allLearners.map((l) => ({ id: l.learner_id, name: l.name }))}
        />
      </Suspense>

      {roleId && (
        <Suspense>
          <MatchingStatusFilter statusCounts={statusCounts} total={rows.length} />
        </Suspense>
      )}

      <MatchingTable
        key={roleId ?? 'all'}
        rows={filteredRows}
        roleSelected={!!roleId}
        subCohortOptions={subCohortOptions}
        nsReasons={(nsRow?.value as string[]) ?? undefined}
        rejectionReasons={(rejRow?.value as string[]) ?? undefined}
      />

    </div>
  )
}
