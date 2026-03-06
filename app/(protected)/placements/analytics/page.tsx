import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlacementFunnel from '@/components/placements/PlacementFunnel'
import ActionCentre from '@/components/placements/ActionCentre'
import TatDeepDive from '@/components/placements/TatDeepDive'

// ── TAT Deep Dive cutoff ──────────────────────────────────────────────────────
// Only applications created on or after this date are counted for TAT metrics.
// Update this to the date from which the team commits to setting status timestamps.
const TAT_CUTOFF_DATE = '2026-03-05'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'LF') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: roles }, { data: applications }, { data: preferences }, { data: tatApps }] = await Promise.all([
    supabase.from('roles').select('id, created_at'),
    supabase.from('applications').select('status, not_shortlisted_reasons, rejection_reasons'),
    supabase.from('role_preferences').select('reasons').eq('preference', 'not_interested'),
    supabase
      .from('applications')
      .select('created_at, status, shortlisting_decision_taken_at, interviews_started_at, hiring_decision_taken_at')
      .gte('created_at', TAT_CUTOFF_DATE),
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

  return (
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
        <ActionCentre awaitingShortlist={stillApplied} yetToStart={yetToStart} interviewsOngoing={interviewsOngoing} totalApps={totalApps} />
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
  )
}
