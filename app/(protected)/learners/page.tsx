import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import SyncButton from './SyncButton'
import LearnersFilters from './LearnersFilters'

export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  Ongoing: 'bg-emerald-100 text-emerald-700',
  Dropout: 'bg-red-100 text-red-700',
  Discontinued: 'bg-zinc-200 text-zinc-600',
  'Placed - Self': 'bg-blue-100 text-blue-700',
  'Placed - HVA': 'bg-violet-100 text-violet-700',
}

interface Props {
  searchParams: Promise<{ status?: string; batch?: string; viewAll?: string }>
}

export default async function LearnersPage({ searchParams }: Props) {
  const { status, batch, viewAll } = await searchParams

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  let lfId: number | null = null
  if (appUser.role === 'lf' && viewAll !== '1') {
    const { data: lf } = await supabase
      .from('lfs')
      .select('id')
      .eq('email', appUser.email)
      .single()
    lfId = lf?.id ?? null
  }

  let query = supabase.from('learners').select('*').order('name')
  if (lfId) query = query.eq('lf_id', lfId)
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

  const title = appUser.role === 'lf' && viewAll !== '1' ? 'My Learners' : 'Learners'

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {learners?.length ?? 0} result{learners?.length !== 1 ? 's' : ''}
            {status ? ` · ${status}` : ''}
            {batch ? ` · ${batch}` : ''}
          </p>
        </div>
        {appUser.role === 'admin' && <SyncButton />}
      </div>

      <div className="mb-5">
        <Suspense>
          <LearnersFilters
            statuses={statuses}
            batches={batches}
            isLF={appUser.role === 'lf'}
            viewAll={viewAll === '1'}
          />
        </Suspense>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Name
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Email
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Batch
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Status
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  LF
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Track
                </th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {learners?.map((learner) => (
                <tr key={learner.email} className="hover:bg-zinc-50">
                  <td className="px-6 py-3.5 font-medium text-zinc-900">{learner.name}</td>
                  <td className="px-6 py-3.5 text-zinc-400">{learner.email}</td>
                  <td className="px-6 py-3.5 text-zinc-600">{learner.batch_name}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[learner.status] ?? 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {learner.status}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-600">{learner.lf_name}</td>
                  <td className="px-6 py-3.5 text-zinc-600">{learner.track}</td>
                  <td className="px-6 py-3.5 text-zinc-400">{learner.join_date ?? '—'}</td>
                </tr>
              ))}
              {(!learners || learners.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-zinc-400">
                    No learners found.
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
