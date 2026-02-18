import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
import SyncButton from './SyncButton'
import LearnersFilters from './LearnersFilters'

interface Props {
  searchParams: Promise<{ status?: string; batch?: string }>
}

export default async function LearnersPage({ searchParams }: Props) {
  const { status, batch } = await searchParams

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let query = supabase.from('learners').select('*').order('name')
  if (status) query = query.eq('status', status)
  if (batch) query = query.eq('batch_name', batch)
  const { data: learners } = await query

  const { data: allLearners } = await supabase
    .from('learners')
    .select('status, batch_name')

  const statuses = Array.from(
    new Set(allLearners?.map((l) => l.status).filter(Boolean))
  ).sort() as string[]

  const batches = Array.from(
    new Set(allLearners?.map((l) => l.batch_name).filter(Boolean))
  ).sort() as string[]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Learners</h1>
        <SyncButton />
      </div>

      <div className="mb-4">
        <Suspense>
          <LearnersFilters statuses={statuses} batches={batches} />
        </Suspense>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="pb-3 pr-6 font-medium">Name</th>
              <th className="pb-3 pr-6 font-medium">Email</th>
              <th className="pb-3 pr-6 font-medium">Batch</th>
              <th className="pb-3 pr-6 font-medium">Status</th>
              <th className="pb-3 pr-6 font-medium">LF</th>
              <th className="pb-3 pr-6 font-medium">Track</th>
              <th className="pb-3 font-medium">Join Date</th>
            </tr>
          </thead>
          <tbody>
            {learners?.map((learner) => (
              <tr key={learner.email} className="border-b hover:bg-gray-50">
                <td className="py-3 pr-6">{learner.name}</td>
                <td className="py-3 pr-6 text-gray-500">{learner.email}</td>
                <td className="py-3 pr-6">{learner.batch_name}</td>
                <td className="py-3 pr-6">{learner.status}</td>
                <td className="py-3 pr-6">{learner.lf_name}</td>
                <td className="py-3 pr-6">{learner.track}</td>
                <td className="py-3">{learner.join_date ?? '—'}</td>
              </tr>
            ))}
            {(!learners || learners.length === 0) && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">
                  No learners found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
