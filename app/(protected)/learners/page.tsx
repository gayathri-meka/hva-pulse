import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import LearnersFilters from './LearnersFilters'
import LearnersTable from '@/components/learners/LearnersTable'
import SnapshotControls from '@/components/learners/SnapshotControls'
import LearnerSnapshot, {
  type SnapshotLearner,
  type SnapshotApp,
  type SnapshotDeclinedRole,
} from '@/components/learners/LearnerSnapshot'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ status?: string; batch?: string; lf?: string; viewAll?: string; tab?: string; learner?: string }>
}

export default async function LearnersPage({ searchParams }: Props) {
  const { status, batch, lf, viewAll, tab, learner: learnerParam } = await searchParams

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase    = await createServerSupabaseClient()
  const isSnapshot  = tab === 'snapshot'
  const filterByLF  = appUser.role === 'LF' && viewAll !== '1'

  // ── Always fetch learners (needed for both tabs) ───────────────────────────
  let query = supabase.from('learners').select('*, users!learners_user_id_fkey(name, email)')
  if (filterByLF) query = query.eq('lf_user_id', appUser.id)
  if (status) {
    const statuses = status.split(',')
    query = statuses.length > 1 ? query.in('status', statuses) : query.eq('status', status)
  }
  if (batch)  query = query.eq('batch_name', batch)
  if (lf)     query = query.eq('lf_name', lf)

  const { data: rawLearners } = await query

  type RawLearner = {
    learner_id: string; user_id: string | null; lf_user_id: string | null
    phone_number: string; category: string; lf_name: string; new_lf: string | null; status: string
    batch_name: string; tech_mentor_name: string; core_skills_mentor_name: string
    track: string; join_date: string | null
    year_of_graduation: number | null; degree: string | null; specialisation: string | null
    current_location: string | null; prs: number | null; readiness: string | null
    blacklisted_date: string | null; proactiveness: number | null; articulation: number | null
    comprehension: number | null; tech_score: number | null
    users: { name: string; email: string } | null
  }

  const learners = ((rawLearners ?? []) as RawLearner[])
    .map((l) => ({ ...l, users: undefined, name: l.users?.name ?? '', email: l.users?.email ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Filter options (for All Learners tab) ─────────────────────────────────
  const { data: allLearners } = await supabase.from('learners').select('status, batch_name, lf_name')
  const statuses = Array.from(new Set(allLearners?.map((l) => l.status).filter(Boolean))).sort() as string[]
  const batches  = Array.from(new Set(allLearners?.map((l) => l.batch_name).filter(Boolean))).sort() as string[]
  const lfs      = Array.from(new Set(allLearners?.map((l) => l.lf_name).filter(Boolean))).sort() as string[]

  // ── Snapshot tab: fetch placement data for the selected learner ───────────
  let snapshotLearner: SnapshotLearner | null = null
  let snapshotApps:    SnapshotApp[]          = []
  let snapshotDeclined: SnapshotDeclinedRole[] = []
  let snapshotResume = null

  if (isSnapshot && learnerParam) {
    const found = learners.find((l) => l.learner_id === learnerParam)
    if (found) {
      snapshotLearner = found as SnapshotLearner

      if (found.user_id) {
        const [
          { data: rawApps },
          { data: rawRoles },
          { data: rawCompanies },
          { data: rawPrefs },
          { data: rawResume },
        ] = await Promise.all([
          supabase
            .from('applications')
            .select('id, status, created_at, role_id, not_shortlisted_reason, not_shortlisted_reasons, rejection_feedback, rejection_reasons')
            .eq('user_id', found.user_id)
            .order('created_at', { ascending: false }),
          supabase.from('roles').select('id, company_id, role_title'),
          supabase.from('companies').select('id, company_name'),
          supabase
            .from('role_preferences')
            .select('role_id, reasons')
            .eq('user_id', found.user_id)
            .eq('preference', 'not_interested'),
          supabase
            .from('resumes')
            .select('file_url, version_name, created_at')
            .eq('user_id', found.user_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        const roleMap    = Object.fromEntries((rawRoles ?? []).map((r) => [r.id, r]))
        const companyMap = Object.fromEntries((rawCompanies ?? []).map((c) => [c.id, c.company_name]))

        snapshotApps = (rawApps ?? []).map((a) => {
          const role = roleMap[a.role_id]
          return {
            id:                      a.id,
            status:                  a.status,
            created_at:              a.created_at,
            not_shortlisted_reason:  a.not_shortlisted_reason ?? null,
            not_shortlisted_reasons: (a.not_shortlisted_reasons as string[]) ?? [],
            rejection_feedback:      a.rejection_feedback ?? null,
            rejection_reasons:       (a.rejection_reasons as string[]) ?? [],
            role_title:              role?.role_title   ?? 'Unknown Role',
            company_name:            companyMap[role?.company_id ?? ''] ?? 'Unknown Company',
          }
        })

        snapshotDeclined = (rawPrefs ?? [])
          .filter((p) => roleMap[p.role_id])
          .map((p) => {
            const role = roleMap[p.role_id]
            return {
              role_id:      p.role_id,
              role_title:   role.role_title,
              company_name: companyMap[role.company_id] ?? '',
              reasons:      (p.reasons as string[]) ?? [],
            }
          })

        snapshotResume = rawResume ?? null
      }
    }
  }

  const title = appUser.role === 'LF' && viewAll !== '1' ? 'My Learners' : 'Learners'

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">{title}</h1>
        {!isSnapshot && (
          <p className="mt-1 text-sm text-zinc-500">
            {learners.length} result{learners.length !== 1 ? 's' : ''}
            {status ? ` · ${status}` : ''}
            {batch  ? ` · ${batch}`  : ''}
            {lf     ? ` · ${lf}`     : ''}
          </p>
        )}
      </div>

      {/* Tab nav */}
      <div className="mb-6 overflow-x-auto border-b border-zinc-200">
        <nav className="flex gap-6">
          <Link
            href="/learners"
            className={`relative pb-3 text-sm font-medium transition-colors ${
              !isSnapshot ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            All Learners
            {!isSnapshot && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
          </Link>
          <Link
            href="/learners?tab=snapshot"
            className={`relative pb-3 text-sm font-medium transition-colors ${
              isSnapshot ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Learner Snapshot
            {isSnapshot && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
          </Link>
        </nav>
      </div>

      {/* ── All Learners tab ───────────────────────────────────────────── */}
      {!isSnapshot && (
        <>
          <div className="mb-5">
            <Suspense>
              <LearnersFilters
                statuses={statuses}
                batches={batches}
                lfs={lfs}
                isLF={appUser.role === 'LF'}
                viewAll={viewAll === '1'}
              />
            </Suspense>
          </div>
          <LearnersTable learners={learners} />
        </>
      )}

      {/* ── Snapshot tab ───────────────────────────────────────────────── */}
      {isSnapshot && (
        <div className="space-y-6">
          <Suspense>
            <SnapshotControls
              learners={learners.map((l) => ({ id: l.learner_id, name: l.name }))}
            />
          </Suspense>

          {snapshotLearner ? (
            <LearnerSnapshot
              learner={snapshotLearner}
              apps={snapshotApps}
              declinedRoles={snapshotDeclined}
              resume={snapshotResume}
            />
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-white px-6 py-16 text-center text-sm text-zinc-400 shadow-sm">
              Select a learner above to view their snapshot.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
