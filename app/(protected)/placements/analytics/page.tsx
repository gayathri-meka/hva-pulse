import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlacementFunnel from '@/components/placements/PlacementFunnel'
import ActionCentre from '@/components/placements/ActionCentre'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'LF') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: roles }, { data: applications }, { data: preferences }] = await Promise.all([
    supabase.from('roles').select('id, created_at'),
    supabase.from('applications').select('status, not_shortlisted_reasons, rejection_reasons'),
    supabase.from('role_preferences').select('reasons').eq('preference', 'not_interested'),
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

  const weekCounts: Record<number, number> = {}
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
    .map(({ weeksAgo, count }) => ({
      label: weeksAgo === 0 ? 'This week' : weeksAgo === 1 ? 'Last week' : `${weeksAgo} wks ago`,
      count,
    }))

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
    <div className="grid grid-cols-2 items-start gap-10">
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

      {/* Right: action centre */}
      <div className="pt-2">
        <ActionCentre awaitingShortlist={stillApplied} yetToStart={yetToStart} interviewsOngoing={interviewsOngoing} totalApps={totalApps} />
      </div>
    </div>
  )
}
