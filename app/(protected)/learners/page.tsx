import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import SyncButton from './SyncButton'
import LearnersFilters from './LearnersFilters'
import LearnersTable from '@/components/learners/LearnersTable'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string; batch?: string; viewAll?: string }>
}

export default async function LearnersPage({ searchParams }: Props) {
  const { status, batch, viewAll } = await searchParams

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  // LF filtering: filter by learners.lf_user_id = current user's id
  const filterByLF = appUser.role === 'LF' && viewAll !== '1'

  let query = supabase
    .from('learners')
    .select('*, users!learners_user_id_fkey(name, email)')

  if (filterByLF) query = query.eq('lf_user_id', appUser.id)
  if (status) query = query.eq('status', status)
  if (batch) query = query.eq('batch_name', batch)

  const { data: rawLearners } = await query

  // Flatten the nested users join into flat objects, sort by name
  type RawLearner = {
    learner_id: string; user_id: string; lf_user_id: string | null
    phone_number: string; category: string; lf_name: string; status: string
    batch_name: string; tech_mentor_name: string; core_skills_mentor_name: string
    track: string; join_date: string | null
    users: { name: string; email: string } | null
  }
  const learners = ((rawLearners ?? []) as RawLearner[])
    .map((l) => ({ ...l, users: undefined, name: l.users?.name ?? '', email: l.users?.email ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Fetch distinct filter options
  const { data: allLearners } = await supabase
    .from('learners')
    .select('status, batch_name')

  const statuses = Array.from(
    new Set(allLearners?.map((l) => l.status).filter(Boolean))
  ).sort() as string[]

  const batches = Array.from(
    new Set(allLearners?.map((l) => l.batch_name).filter(Boolean))
  ).sort() as string[]

  const title = appUser.role === 'LF' && viewAll !== '1' ? 'My Learners' : 'Learners'

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {learners.length} result{learners.length !== 1 ? 's' : ''}
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
            isLF={appUser.role === 'LF'}
            viewAll={viewAll === '1'}
          />
        </Suspense>
      </div>

      <LearnersTable learners={learners} />
    </div>
  )
}
