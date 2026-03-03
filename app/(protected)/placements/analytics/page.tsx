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
    supabase.from('roles').select('id'),
    supabase.from('applications').select('status, not_shortlisted_reasons, rejection_reasons'),
    supabase.from('role_preferences').select('reasons').eq('preference', 'not_interested'),
  ])

  const allApps       = applications ?? []
  const allPrefs      = preferences ?? []
  const totalRoles    = roles?.length ?? 0
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

  const shortlisted    = allApps.filter((a) => a.status === 'shortlisted').length
  const onHold         = allApps.filter((a) => a.status === 'on_hold').length
  const notShortlisted = allApps.filter((a) => a.status === 'not_shortlisted').length
  const stillApplied   = allApps.filter((a) => a.status === 'applied').length
  const hired          = allApps.filter((a) => a.status === 'hired').length
  const rejected       = allApps.filter((a) => a.status === 'rejected').length

  // Everyone who passed the shortlisting gate (used as stage-3 denominator)
  const shortlistPassed = shortlisted + onHold + hired + rejected
  // Still actively in the interview process
  const inProcess = shortlisted + onHold

  return (
    <div className="grid grid-cols-2 items-start gap-10">
      {/* Left: vertical funnel */}
      <div>
        <PlacementFunnel
          totalRoles={totalRoles}
          notInterested={notInterested}
          totalApps={totalApps}
          notShortlisted={notShortlisted}
          stillApplied={stillApplied}
          shortlistPassed={shortlistPassed}
          inProcess={inProcess}
          hired={hired}
          rejected={rejected}
          reasonCounts={reasonCounts}
          notShortlistedReasonCounts={notShortlistedReasonCounts}
          rejectionReasonCounts={rejectionReasonCounts}
        />
      </div>

      {/* Right: action centre */}
      <div className="pt-2">
        <ActionCentre awaitingShortlist={stillApplied} inProcess={inProcess} totalApps={totalApps} />
      </div>
    </div>
  )
}
