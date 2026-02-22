import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: companies }, { data: roles }, { data: applications }] = await Promise.all([
    supabase.from('companies').select('id'),
    supabase.from('roles').select('id, status'),
    supabase.from('applications').select('status'),
  ])

  const totalCompanies = companies?.length ?? 0
  const openRoles = roles?.filter((r) => r.status === 'open').length ?? 0
  const closedRoles = (roles?.length ?? 0) - openRoles
  const totalApplications = applications?.length ?? 0
  const totalHired = applications?.filter((a) => a.status === 'hired').length ?? 0
  const placementRate =
    totalApplications > 0 ? Math.round((totalHired / totalApplications) * 100) : 0

  const stats = [
    {
      label: 'Total Companies',
      value: totalCompanies,
      sub: 'registered',
      cardClass: 'border-zinc-200 bg-white',
      labelClass: 'text-zinc-500',
    },
    {
      label: 'Open Roles',
      value: openRoles,
      sub: `${closedRoles} closed`,
      cardClass: 'border-emerald-100 bg-emerald-50',
      labelClass: 'text-emerald-600',
    },
    {
      label: 'Applications',
      value: totalApplications,
      sub: 'total submitted',
      cardClass: 'border-blue-100 bg-blue-50',
      labelClass: 'text-blue-600',
    },
    {
      label: 'Hired',
      value: totalHired,
      sub: 'confirmed offers',
      cardClass: 'border-violet-100 bg-violet-50',
      labelClass: 'text-violet-600',
    },
    {
      label: 'Placement Rate',
      value: `${placementRate}%`,
      sub: 'hired / total apps',
      cardClass: 'border-amber-100 bg-amber-50',
      labelClass: 'text-amber-600',
    },
  ]

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map(({ label, value, sub, cardClass, labelClass }) => (
          <div key={label} className={`rounded-xl border p-6 shadow-sm ${cardClass}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>
              {label}
            </p>
            <p className="mt-3 text-4xl font-bold text-zinc-900">{value}</p>
            <p className="mt-1 text-xs text-zinc-400">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
