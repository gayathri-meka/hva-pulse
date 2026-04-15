import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlacementFunnel from '@/components/placements/PlacementFunnel'
import ActionCentre from '@/components/placements/ActionCentre'
import TatDeepDive from '@/components/placements/TatDeepDive'
import AnalyticsFilters from '@/components/placements/AnalyticsFilters'
import PlacementHealth from '@/components/placements/PlacementHealth'
import type { PlacementThresholds } from './actions'

// TAT cutoff date is now configurable via Placements → Settings.
// Falls back to '2026-03-05' if not yet set in the settings table.
const DEFAULT_TAT_CUTOFF = '2026-03-05'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ lf?: string; batch?: string }>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'staff' && appUser.role !== 'guest') redirect('/dashboard')

  const { lf, batch } = await searchParams

  const supabase = await createServerSupabaseClient()

  // ── Filter: resolve learner user_ids for LF / batch ───────────────────────
  const [{ data: allLearners }, { data: filteredLearners }] = await Promise.all([
    supabase.from('learners').select('lf_name, batch_name'),
    (lf || batch)
      ? (() => {
          let q = supabase.from('learners').select('user_id')
          if (lf)    q = q.eq('lf_name',    lf)
          if (batch) q = q.eq('batch_name', batch)
          return q
        })()
      : Promise.resolve({ data: null, error: null }),
  ])

  const lfs     = Array.from(new Set(allLearners?.map((l) => l.lf_name).filter(Boolean))).sort()    as string[]
  const batches = Array.from(new Set(allLearners?.map((l) => l.batch_name).filter(Boolean))).sort() as string[]

  const filterUserIds = filteredLearners
    ? filteredLearners.map((l) => l.user_id).filter((id): id is string => !!id)
    : null

  // ── Load TAT cutoff from settings ────────────────────────────────────────────
  const { data: tatCutoffRow } = await supabase.from('settings').select('value').eq('key', 'tat_cutoff_date').maybeSingle()
  const TAT_CUTOFF_DATE = (tatCutoffRow?.value as string) ?? DEFAULT_TAT_CUTOFF

  // ── Main data queries (filtered when applicable) ───────────────────────────
  let appsQuery = supabase.from('applications').select('status, not_shortlisted_reasons, rejection_reasons, created_at')
  let prefsQuery = supabase.from('role_preferences').select('reasons').eq('preference', 'not_interested')
  let tatQuery  = supabase
    .from('applications')
    .select('created_at, status, shortlisting_decision_taken_at, interviews_started_at, hiring_decision_taken_at, users(name), roles(role_title, companies(company_name))')
    .gte('created_at', TAT_CUTOFF_DATE)

  if (filterUserIds) {
    appsQuery  = appsQuery.in('user_id',  filterUserIds)
    prefsQuery = prefsQuery.in('user_id', filterUserIds)
    tatQuery   = tatQuery.in('user_id',   filterUserIds)
  }

  const [{ data: roles }, { data: applications }, { data: preferences }, { data: tatApps, error: tatError }, { data: settingsRow }] = await Promise.all([
    supabase.from('roles').select('id, created_at, status'), // roles are not learner-specific
    appsQuery,
    prefsQuery,
    tatQuery,
    supabase.from('settings').select('value').eq('key', 'placement_thresholds').single(),
  ])

  const DEFAULT_THRESHOLDS: PlacementThresholds = { demand_target: 10, engagement_target: 5, conversion_target: 0.5 }
  const thresholds: PlacementThresholds = (settingsRow?.value as PlacementThresholds) ?? DEFAULT_THRESHOLDS

  const allApps       = applications ?? []
  const allPrefs      = preferences ?? []
  const totalRoles    = roles?.length ?? 0

  // Weekly roles breakdown
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1 // 0=Mon
  const startOfCurrentWeek = new Date(now)
  startOfCurrentWeek.setHours(0, 0, 0, 0)
  startOfCurrentWeek.setDate(now.getDate() - dayOfWeek)

  const weekCounts: Record<number, number> = { 0: 0 } // always show current week, even if zero
  for (const role of roles ?? []) {
    if (!role.created_at) continue
    const d = new Date(role.created_at)
    // Snap to the Monday of the role's own week, then diff Monday-to-Monday.
    // Without this, Math.floor on a fractional week (e.g. Tue–Sun of a prior week)
    // rounds down into the wrong bucket.
    const roleDow = d.getDay() === 0 ? 6 : d.getDay() - 1
    const roleMonday = new Date(d)
    roleMonday.setHours(0, 0, 0, 0)
    roleMonday.setDate(d.getDate() - roleDow)
    const diffMs = startOfCurrentWeek.getTime() - roleMonday.getTime()
    const weeksAgo = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    if (weeksAgo >= 0) weekCounts[weeksAgo] = (weekCounts[weeksAgo] ?? 0) + 1
  }

  const weeklyRoles = Object.entries(weekCounts)
    .map(([w, count]) => ({ weeksAgo: Number(w), count }))
    .sort((a, b) => a.weeksAgo - b.weeksAgo)
    .map(({ weeksAgo, count }) => {
      const monday = new Date(startOfCurrentWeek)
      monday.setDate(monday.getDate() - weeksAgo * 7)
      const label   = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const isoDate = monday.toISOString().slice(0, 10)
      return { label, isoDate, count }
    })

  const notInterested = allPrefs.length
  const totalApps     = allApps.length

  const reasonCounts: Record<string, number> = {}
  for (const pref of allPrefs) {
    for (const reason of (pref.reasons as string[]) ?? []) {
      reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
    }
  }

  const notShortlistedReasonCounts: Record<string, number> = {}
  for (const app of allApps) {
    if (app.status === 'not_shortlisted') {
      for (const reason of (app.not_shortlisted_reasons as string[]) ?? []) {
        notShortlistedReasonCounts[reason] = (notShortlistedReasonCounts[reason] ?? 0) + 1
      }
    }
  }

  const rejectionReasonCounts: Record<string, number> = {}
  for (const app of allApps) {
    if (app.status === 'rejected') {
      for (const reason of (app.rejection_reasons as string[]) ?? []) {
        rejectionReasonCounts[reason] = (rejectionReasonCounts[reason] ?? 0) + 1
      }
    }
  }

  // ── TAT Deep Dive ──────────────────────────────────────────────────────────
  type TatApp = {
    created_at:                      string
    status:                          string
    shortlisting_decision_taken_at:  string | null
    interviews_started_at:           string | null
    hiring_decision_taken_at:        string | null
    users:                           { name: string } | null
    roles:                           { role_title: string; companies: { company_name: string } | null } | null
  }

  function avgDays(pairs: [string | null | undefined, string | null | undefined][]): { avg: number | null; n: number } {
    const diffs = pairs
      .filter(([a, b]) => a && b)
      .map(([a, b]) => (new Date(b!).getTime() - new Date(a!).getTime()) / (1000 * 60 * 60 * 24))
      .filter((d) => d >= 0)
    if (diffs.length === 0) return { avg: null, n: 0 }
    return { avg: Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length), n: diffs.length }
  }

  if (tatError) console.error('[TAT] Query error:', tatError)
  const tat = (tatApps ?? []) as unknown as TatApp[]

  // Stage 1 — Time to screening (HVA's control)
  // created_at → shortlisting_decision_taken_at for all apps with a screening decision
  const tatScreening = avgDays(tat.map((a) => [a.created_at, a.shortlisting_decision_taken_at]))

  // Stage 2 — Screening to final outcome (company's control)
  // shortlisting_decision_taken_at → hiring_decision_taken_at for shortlisted apps that reached a final outcome
  const tatOutcome = avgDays(
    tat
      .filter((a) => (a.status === 'hired' || a.status === 'rejected') && a.shortlisting_decision_taken_at && a.hiring_decision_taken_at)
      .map((a) => [a.shortlisting_decision_taken_at, a.hiring_decision_taken_at])
  )

  // Rejection breakdown: of all rejected, how many got interviews?
  const rejectedApps          = tat.filter((a) => a.status === 'rejected')
  const rejectedWithInterview = rejectedApps.filter((a) => a.interviews_started_at).length
  const rejectedNoInterview   = rejectedApps.length - rejectedWithInterview

  // Build detail rows for the popup table
  const tatDetails = tat.map((a) => ({
    learnerName:  (a.users as unknown as { name: string } | null)?.name ?? '—',
    companyName:  (a.roles as unknown as { role_title: string; companies: { company_name: string } | null } | null)?.companies?.company_name ?? '—',
    roleName:     (a.roles as unknown as { role_title: string } | null)?.role_title ?? '—',
    status:       a.status,
    appliedAt:    a.created_at,
    screenedAt:   a.shortlisting_decision_taken_at,
    interviewAt:  a.interviews_started_at,
    outcomeAt:    a.hiring_decision_taken_at,
  }))

  const tatCutoffLabel = new Date(TAT_CUTOFF_DATE + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  const yetToStart        = allApps.filter((a) => a.status === 'shortlisted').length
  const interviewsOngoing = allApps.filter((a) => a.status === 'interviews_ongoing').length
  const onHold            = allApps.filter((a) => a.status === 'on_hold').length
  const notShortlisted    = allApps.filter((a) => a.status === 'not_shortlisted').length
  const stillApplied      = allApps.filter((a) => a.status === 'applied').length
  const hired             = allApps.filter((a) => a.status === 'hired').length
  const rejected          = allApps.filter((a) => a.status === 'rejected').length

  // Everyone who passed the shortlisting gate (used as stage-3 denominator)
  const shortlistPassed = yetToStart + interviewsOngoing + onHold + hired + rejected

  // ── Age stats for Action Centre ──────────────────────────────────────────────
  type AgeStats = { oldest: number; avg: number; buckets: { gt14: number; d7to14: number; d1to7: number } }

  function ageStats(apps: { created_at: string | null | undefined }[]): AgeStats {
    const nowMs = Date.now()
    const days  = apps
      .map((a) => a.created_at ? Math.floor((nowMs - new Date(a.created_at).getTime()) / 86_400_000) : 0)
    if (days.length === 0) return { oldest: 0, avg: 0, buckets: { gt14: 0, d7to14: 0, d1to7: 0 } }
    const oldest  = Math.max(...days)
    const avg     = Math.round(days.reduce((s, d) => s + d, 0) / days.length)
    const buckets = {
      gt14:   days.filter((d) => d > 14).length,
      d7to14: days.filter((d) => d > 7 && d <= 14).length,
      d1to7:  days.filter((d) => d <= 7).length,
    }
    return { oldest, avg, buckets }
  }

  const appliedAge           = ageStats(allApps.filter((a) => a.status === 'applied'))
  const shortlistedAge       = ageStats(allApps.filter((a) => a.status === 'shortlisted'))
  const interviewsOngoingAge = ageStats(allApps.filter((a) => a.status === 'interviews_ongoing'))

  // ── Placement Health metrics ──────────────────────────────────────────────
  const openRoles        = roles?.filter((r) => r.status === 'open').length ?? 0
  const last4Weeks       = weeklyRoles.slice(0, 4)
  const weeklyAvg        = last4Weeks.length > 0
    ? last4Weeks.reduce((s, w) => s + w.count, 0) / last4Weeks.length
    : 0
  const appsPerRole      = totalRoles > 0 ? totalApps / totalRoles : 0
  const notInterestedRate = (totalApps + notInterested) > 0
    ? notInterested / (totalApps + notInterested)
    : 0
  const shortlistRate    = totalApps > 0 ? shortlistPassed / totalApps : 0
  const hireRate         = (hired + rejected) > 0 ? hired / (hired + rejected) : 0

  return (
    <div>
    <Suspense fallback={null}>
      <AnalyticsFilters lfs={lfs} batches={batches} />
    </Suspense>
    <div className="mb-8">
      <PlacementHealth
        openRoles={openRoles}
        weeklyAvg={weeklyAvg}
        appsPerRole={appsPerRole}
        notInterestedRate={notInterestedRate}
        shortlistRate={shortlistRate}
        hireRate={hireRate}
        totalRoles={totalRoles}
        totalApps={totalApps}
        thresholds={thresholds}
        isAdmin={appUser.role === 'admin'}
      />
    </div>
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2 lg:gap-10">
      {/* Left: vertical funnel */}
      <div>
        <PlacementFunnel
          totalRoles={totalRoles}
          weeklyRoles={weeklyRoles}
          notInterested={notInterested}
          totalApps={totalApps}
          notShortlisted={notShortlisted}
          stillApplied={stillApplied}
          shortlistPassed={shortlistPassed}
          yetToStart={yetToStart}
          interviewsOngoing={interviewsOngoing}
          onHold={onHold}
          hired={hired}
          rejected={rejected}
          reasonCounts={reasonCounts}
          notShortlistedReasonCounts={notShortlistedReasonCounts}
          rejectionReasonCounts={rejectionReasonCounts}
        />
      </div>

      {/* Right: action centre + TAT */}
      <div className="pt-2">
        <ActionCentre
          awaitingShortlist={stillApplied}
          yetToStart={yetToStart}
          interviewsOngoing={interviewsOngoing}
          totalApps={totalApps}
          appliedAge={appliedAge}
          shortlistedAge={shortlistedAge}
          interviewsOngoingAge={interviewsOngoingAge}
        />
        <TatDeepDive
          screening={tatScreening}
          outcome={tatOutcome}
          rejectedTotal={rejectedApps.length}
          rejectedWithInterview={rejectedWithInterview}
          rejectedNoInterview={rejectedNoInterview}
          cutoffDate={tatCutoffLabel}
          details={tatDetails}
        />
      </div>
    </div>
    </div>
  )
}
