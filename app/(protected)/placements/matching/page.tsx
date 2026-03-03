import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import MatchingControls from '@/components/placements/MatchingControls'
import MatchingStatusFilter from '@/components/placements/MatchingStatusFilter'
import MatchingTable, { type MatchingRow, type MatchingStatus } from '@/components/placements/MatchingTable'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ role?: string; batch?: string; lf?: string; status?: string; learner?: string }>
}

export default async function MatchingPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'LF') redirect('/dashboard')

  const { role: roleId, status: statusFilter, learner: learnerFilter } = await searchParams

  const supabase = await createServerSupabaseClient()

  // Always fetch: roles + companies (for dropdown), learners (for table + filters)
  // Conditionally fetch: applications + preferences only when a role is selected
  const [
    { data: roles },
    { data: companies },
    { data: rawLearners },
    { data: rawApplications },
    { data: rawPreferences },
  ] = await Promise.all([
    supabase.from('roles').select('id, company_id, role_title, status').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, company_name'),
    supabase.from('learners').select('*, users!learners_user_id_fkey(name, email)'),
    roleId
      ? supabase.from('applications').select('user_id, status, not_shortlisted_reason, rejection_feedback').eq('role_id', roleId)
      : Promise.resolve({ data: null, error: null }),
    roleId
      ? supabase.from('role_preferences').select('user_id, reasons').eq('role_id', roleId).eq('preference', 'not_interested')
      : Promise.resolve({ data: null, error: null }),
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
    blacklisted_date:   string | null
  }
  const allLearners = ((rawLearners ?? []) as RawLearner[]).map((l) => ({
    learner_id:         l.learner_id,
    user_id:            l.user_id,
    name:               l.users?.name ?? '',
    batch:              l.batch_name ?? '',
    lf:                 l.lf_name ?? '',
    year_of_graduation: l.year_of_graduation,
    degree:             l.degree,
    specialisation:     l.specialisation,
    prs:                l.prs,
    proactiveness:      l.proactiveness,
    articulation:       l.articulation,
    comprehension:      l.comprehension,
    tech_score:         l.tech_score,
    current_location:   l.current_location,
    blacklisted_date:   l.blacklisted_date,
  }))

  // ── Apply learner filter (server-side; batch/LF handled by column filters) ─
  const filtered = allLearners
    .filter((l) => !learnerFilter || l.learner_id === learnerFilter)
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Derive placement status per learner ──────────────────────────────────
  // Map user_id → { status, not_shortlisted_reason, rejection_feedback }
  const appMap = Object.fromEntries(
    (rawApplications ?? [])
      .filter((a) => a.user_id)
      .map((a) => [a.user_id!, {
        status:                 a.status as MatchingStatus,
        not_shortlisted_reason: (a.not_shortlisted_reason as string | null) ?? null,
        rejection_feedback:     (a.rejection_feedback     as string | null) ?? null,
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
    is_blacklisted:     l.blacklisted_date !== null,
    blacklisted_date:   l.blacklisted_date,
  })

  const rows: MatchingRow[] = filtered.map((l) => {
    if (!roleId) {
      return {
        learner_id:             l.learner_id,
        name:                   l.name,
        batch:                  l.batch,
        lf:                     l.lf,
        ...sharedLearnerFields(l),
        status:                 'not_applied' as MatchingStatus, // placeholder; Status column hidden
        reasons:                [],
        not_shortlisted_reason: null,
        rejection_feedback:     null,
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
      learner_id:             l.learner_id,
      name:                   l.name,
      batch:                  l.batch,
      lf:                     l.lf,
      ...sharedLearnerFields(l),
      status,
      reasons:                status === 'not_interested' && l.user_id ? (reasonsMap[l.user_id] ?? []) : [],
      not_shortlisted_reason: appDetail?.not_shortlisted_reason ?? null,
      rejection_feedback:     appDetail?.rejection_feedback     ?? null,
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

      {/* Controls */}
      <Suspense>
        <MatchingControls
          roles={roleOptions}
          learners={allLearners.map((l) => ({ id: l.learner_id, name: l.name }))}
        />
      </Suspense>

      {/* Status filter pills — only meaningful when a role is selected */}
      {roleId && (
        <Suspense>
          <MatchingStatusFilter statusCounts={statusCounts} total={rows.length} />
        </Suspense>
      )}

      <MatchingTable rows={filteredRows} roleSelected={!!roleId} />

    </div>
  )
}
