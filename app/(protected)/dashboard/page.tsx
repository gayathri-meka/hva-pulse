import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = [
  {
    key: 'Ongoing',
    label: 'Ongoing',
    cardClass: 'border-emerald-100 bg-emerald-50',
    labelClass: 'text-emerald-600',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  {
    key: 'Dropout',
    label: 'Dropout',
    cardClass: 'border-red-100 bg-red-50',
    labelClass: 'text-red-500',
    iconBg: 'bg-red-100',
    iconColor: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-700',
  },
  {
    key: 'Discontinued',
    label: 'Discontinued',
    cardClass: 'border-zinc-200 bg-zinc-100',
    labelClass: 'text-zinc-500',
    iconBg: 'bg-zinc-200',
    iconColor: 'text-zinc-500',
    badgeClass: 'bg-zinc-200 text-zinc-600',
  },
  {
    key: 'Placed - Self',
    label: 'Placed — Self',
    cardClass: 'border-blue-100 bg-blue-50',
    labelClass: 'text-blue-600',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    key: 'Placed - HVA',
    label: 'Placed — HVA',
    cardClass: 'border-violet-100 bg-violet-50',
    labelClass: 'text-violet-600',
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
]

const STATUS_BADGE: Record<string, string> = {
  Ongoing: 'bg-emerald-100 text-emerald-700',
  Dropout: 'bg-red-100 text-red-700',
  Discontinued: 'bg-zinc-200 text-zinc-600',
  'Placed - Self': 'bg-blue-100 text-blue-700',
  'Placed - HVA': 'bg-violet-100 text-violet-700',
}

export default async function DashboardPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  // LF view
  if (appUser.role === 'lf') {
    const { data: lf } = await supabase
      .from('lfs')
      .select('id')
      .eq('email', appUser.email)
      .single()

    const { data: myLearners } = lf
      ? await supabase
          .from('learners')
          .select('name, batch_name, status, track')
          .eq('lf_id', lf.id)
          .order('name')
      : { data: [] }

    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {myLearners?.length ?? 0} learner{myLearners?.length !== 1 ? 's' : ''} assigned to you
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-4">
            <h2 className="text-sm font-semibold text-zinc-700">My Learners</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Name
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Batch
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Status
                  </th>
                  <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Track
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {myLearners?.map((l) => (
                  <tr key={l.name} className="hover:bg-zinc-50">
                    <td className="px-6 py-3.5 font-medium text-zinc-900">{l.name}</td>
                    <td className="px-6 py-3.5 text-zinc-500">{l.batch_name}</td>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_BADGE[l.status] ?? 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-zinc-500">{l.track}</td>
                  </tr>
                ))}
                {(!myLearners || myLearners.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-zinc-400">
                      No learners assigned yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // Admin view
  const { data: learners } = await supabase.from('learners').select('status')
  const total = learners?.length ?? 0
  const counts: Record<string, number> = {}
  for (const { key } of STATUS_CONFIG) {
    counts[key] = learners?.filter((l) => l.status === key).length ?? 0
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Overview of all learners</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {/* Total card */}
        <div className="col-span-2 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:col-span-1 xl:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Total</p>
          <p className="mt-3 text-4xl font-bold text-zinc-900">{total}</p>
          <p className="mt-1 text-xs text-zinc-400">all learners</p>
        </div>

        {STATUS_CONFIG.map(({ key, label, cardClass, labelClass }) => (
          <div key={key} className={`rounded-xl border p-6 shadow-sm ${cardClass}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${labelClass}`}>
              {label}
            </p>
            <p className="mt-3 text-4xl font-bold text-zinc-900">{counts[key]}</p>
            <p className="mt-1 text-xs text-zinc-400">
              {total > 0 ? Math.round((counts[key] / total) * 100) : 0}%
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
