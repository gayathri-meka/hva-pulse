import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlacementFunnel from '@/components/placements/PlacementFunnel'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: roles }, { data: applications }] = await Promise.all([
    supabase.from('roles').select('id, status'),
    supabase.from('applications').select('status'),
  ])

  const allApps           = applications ?? []
  const totalRoles        = roles?.length ?? 0
  const openRoles         = roles?.filter((r) => r.status === 'open').length ?? 0
  const totalApplications = allApps.length
  const shortlisted       = allApps.filter((a) => a.status === 'shortlisted').length
  const not_shortlisted   = allApps.filter((a) => a.status === 'not_shortlisted').length
  const hired             = allApps.filter((a) => a.status === 'hired').length
  const rejected          = allApps.filter((a) => a.status === 'rejected').length

  return (
    <div>
      <PlacementFunnel
          totalRoles={totalRoles}
          totalApplications={totalApplications}
          shortlisted={shortlisted}
          not_shortlisted={not_shortlisted}
          hired={hired}
          rejected={rejected}
        />
    </div>
  )
}
