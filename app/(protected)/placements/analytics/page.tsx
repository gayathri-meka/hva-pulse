import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlacementFunnel from '@/components/placements/PlacementFunnel'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'LF') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: roles }, { data: applications }, { data: preferences }] = await Promise.all([
    supabase.from('roles').select('id'),
    supabase.from('applications').select('status'),
    supabase.from('role_preferences').select('id').eq('preference', 'not_interested'),
  ])

  const allApps      = applications ?? []
  const totalRoles   = roles?.length ?? 0
  const notInterested = preferences?.length ?? 0
  const totalApps    = allApps.length

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
      />
    </div>
  )
}
