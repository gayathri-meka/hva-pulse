import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlacementFunnel from '@/components/placements/PlacementFunnel'
import ActionCentre from '@/components/placements/ActionCentre'
import TatDeepDive from '@/components/placements/TatDeepDive'
import AnalyticsFilters from '@/components/placements/AnalyticsFilters'
import PlacementHealth from '@/components/placements/PlacementHealth'

// ── TAT Deep Dive cutoff ──────────────────────────────────────────────────────
// Only applications created on or after this date are counted for TAT metrics.
// Update this to the date from which the team commits to setting status timestamps.
const TAT_CUTOFF_DATE = '2026-03-05'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ lf?: string; batch?: string }>
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'LF') redirect('/dashboard')

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

  // ── Main data queries (filtered when applicable) ───────────────────────────
  let appsQuery = supabase.from('applications').select('status, not_shortlisted_reasons, rejection_reasons, created_at')
  let prefsQuery = supabase.from('role_preferences').select('reasons').eq('preference', 'not_interested')
  let tatQuery  = supabase
    .from('applications')
    .select('created_at, status, shortlisting_decision_taken_at, interviews_started_at, hiring_decision_taken_at')
    .gte('created_at', TAT_CUTOFF_DATE)

  if (filterUserIds) {
    appsQuery  = appsQuery.in('user_id',  filterUserIds)
    prefsQuery = prefsQuery.in('user_id', filterUserIds)
    tatQuery   = tatQuery.in('user_id',   filterUserIds)
  }

  const [{ data: roles }, { data: applications }, { data: preferences }, { data: tatApps }] = await Promise.all([
    supabase.from('roles').select('id, created_at, status'), // roles are not learner-specific
    appsQuery,
    prefsQuery,
    tatQuery,
  ])

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
    const diffMs = startOfCurrentWeek.getTime() - d.getTime()
    const weeksAgo = Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)))
    weekCounts[weeksAgo] = (weekCounts[weeksAgo] ?? 0) + 1
  }

  const weeklyRoles = Object.entries(weekCounts)
    .map(([w, count]) => ({ weeksAgo: Number(w), count }))
    .sort((a, b) => a.weeksAgo - b.weeksAgo)
    .map(({ weeksAgo, count }) => {
      const monday = new Date(startOfCurrentWeek)
      monday.setDate(monday.getDate() - weeksAgo * 7)
      const label = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      return { label, count }
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
  }

  function avgDays(pairs: [string | null | undefined, string | null | undefined][]): { avg: number | null; n: number } {
    const diffs = pairs
      .filter(([a, b]) => a && b)
      .map(([a, b]) => (new Date(b!).getTime() - new Date(a!).getTime()) / (1000 * 60 * 60 * 24))
      .filter((d) => d >= 0)
    if (diffs.length === 0) return { avg: null, n: 0 }
    return { avg: Math.round(diffs.reduce((s, d) => s + d, 0) / diffs.length), n: diffs.length }
  }

  const tat = (tatApps ?? []) as TatApp[]

  const tatStage1 = avgDays(tat.map((a) => [a.created_at, a.shortlisting_decision_taken_at]))
  const tatStage2 = avgDays(
    tat
      .filter((a) => a.shortlisting_decision_taken_at && a.interviews_started_at)
      .map((a) => [a.shortlisting_decision_taken_at, a.interviews_started_at])
  )
  const tatStage3 = avgDays(
    tat
      .filter((a) => a.interviews_started_at && a.hiring_decision_taken_at)
      .map((a) => [a.interviews_started_at, a.hiring_decision_taken_at])
  )
  const tatTotal = avgDays(
    tat
      .filter((a) => (a.status === 'hired' || a.status === 'rejected') && a.hiring_decision_taken_at)
      .map((a) => [a.created_at, a.hiring_decision_taken_at])
  )

  const tatCutoffLabel = new Date(TAT_CUTOFF_DATE + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // TODO: remove dummy data once migration 009 is applied and real timestamps accumulate
  const DUMMY_TAT = true
  const [_tatTotal, _tatStage1, _tatStage2, _tatStage3] = [tatTotal, tatStage1, tatStage2, tatStage3]
  const [effectiveTatTotal, effectiveTatStage1, effectiveTatStage2, effectiveTatStage3] = DUMMY_TAT
    ? [{ avg: 34, n: 15 }, { avg: 12, n: 25 }, { avg: 8, n: 18 }, { avg: 14, n: 10 }]
    : [_tatTotal, _tatStage1, _tatStage2, _tatStage3]

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
    <Suspense>
      <AnalyticsFilters lfs={lfs} batches={batches} />
    </Suspense>
    <PlacementHealth
      openRoles={openRoles}
      weeklyAvg={weeklyAvg}
      appsPerRole={appsPerRole}
      notInterestedRate={notInterestedRate}
      shortlistRate={shortlistRate}
      hireRate={hireRate}
      totalRoles={totalRoles}
      totalApps={totalApps}
    />
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
          total={effectiveTatTotal}
          stage1={effectiveTatStage1}
          stage2={effectiveTatStage2}
          stage3={effectiveTatStage3}
          cutoffDate={tatCutoffLabel}
          isDummy={DUMMY_TAT}
        />
      </div>
    </div>
    </div>
  )
}
