import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const STATUSES = [
  { label: 'Ongoing', key: 'Ongoing', bg: 'bg-green-50' },
  { label: 'Dropout', key: 'Dropout', bg: 'bg-red-50' },
  { label: 'Discontinued', key: 'Discontinued', bg: 'bg-gray-50' },
  { label: 'Placed - Self', key: 'Placed - Self', bg: 'bg-blue-50' },
  { label: 'Placed - HVA', key: 'Placed - HVA', bg: 'bg-blue-50' },
]

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: learners } = await supabase.from('learners').select('status')

  const total = learners?.length ?? 0
  const counts: Record<string, number> = {}
  for (const { key } of STATUSES) {
    counts[key] = learners?.filter((l) => l.status === key).length ?? 0
  }

  const { data: lf } = await supabase
    .from('lfs')
    .select('id, name')
    .eq('email', user.email!)
    .single()

  const { data: myLearners } = lf
    ? await supabase
        .from('learners')
        .select('name, batch_name, status, track')
        .eq('lf_id', lf.id)
        .order('name')
    : { data: null }

  return (
    <div>
      <h1 className="mb-8 text-2xl font-semibold">Dashboard</h1>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total</p>
          <p className="mt-2 text-3xl font-semibold">{total}</p>
        </div>
        {STATUSES.map(({ label, key, bg }) => (
          <div key={key} className={`rounded-xl border p-6 shadow-sm ${bg}`}>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold">{counts[key]}</p>
          </div>
        ))}
      </div>

      {lf && myLearners && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">My Learners</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-3 pr-6 font-medium">Name</th>
                <th className="pb-3 pr-6 font-medium">Batch</th>
                <th className="pb-3 pr-6 font-medium">Status</th>
                <th className="pb-3 font-medium">Track</th>
              </tr>
            </thead>
            <tbody>
              {myLearners.map((l) => (
                <tr key={l.name} className="border-b hover:bg-gray-50">
                  <td className="py-3 pr-6">{l.name}</td>
                  <td className="py-3 pr-6">{l.batch_name}</td>
                  <td className="py-3 pr-6">{l.status}</td>
                  <td className="py-3">{l.track}</td>
                </tr>
              ))}
              {myLearners.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400">
                    No learners assigned yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
