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

  const allApps          = applications ?? []
  const totalRoles       = roles?.length ?? 0
  const openRoles        = roles?.filter((r) => r.status === 'open').length ?? 0
  const totalApplications = allApps.length
  const shortlisted      = allApps.filter((a) => a.status === 'shortlisted').length
  const hired            = allApps.filter((a) => a.status === 'hired').length
  const rejected         = allApps.filter((a) => a.status === 'rejected').length

  return (
    <div className="space-y-10">

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Open Roles',
            value: openRoles,
            sub: `${totalRoles - openRoles} closed`,
            card: 'border-emerald-100 bg-emerald-50',
            labelCls: 'text-emerald-600',
          },
          {
            label: 'Applications',
            value: totalApplications,
            sub: 'total submitted',
            card: 'border-blue-100 bg-blue-50',
            labelCls: 'text-blue-600',
          },
          {
            label: 'Shortlisted',
            value: shortlisted,
            sub: totalApplications > 0
              ? `${Math.round((shortlisted / totalApplications) * 100)}% shortlist rate`
              : '—',
            card: 'border-amber-100 bg-amber-50',
            labelCls: 'text-amber-600',
          },
          {
            label: 'Hired',
            value: hired,
            sub: totalApplications > 0
              ? `${Math.round((hired / totalApplications) * 100)}% of applicants`
              : '—',
            card: 'border-violet-100 bg-violet-50',
            labelCls: 'text-violet-600',
          },
        ].map(({ label, value, sub, card, labelCls }) => (
          <div key={label} className={`rounded-xl border p-5 shadow-sm ${card}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${labelCls}`}>{label}</p>
            <p className="mt-2 text-4xl font-bold text-zinc-900">{value}</p>
            <p className="mt-1 text-xs text-zinc-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Funnel */}
      <div>
        <h2 className="mb-6 text-sm font-semibold text-zinc-500 uppercase tracking-wide">
          Placement Funnel
        </h2>
        <PlacementFunnel
          totalRoles={totalRoles}
          totalApplications={totalApplications}
          shortlisted={shortlisted}
          hired={hired}
          rejected={rejected}
        />
      </div>

    </div>
  )
}
