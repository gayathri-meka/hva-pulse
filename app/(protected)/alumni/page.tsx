import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AlumniTable from '@/components/alumni/AlumniTable'
import AlumniAnalytics from '@/components/alumni/AlumniAnalytics'

export const dynamic = 'force-dynamic'

type AlumniJob = {
  company:         string
  role:            string
  salary:          number | null
  starting_salary: number | null
  placement_month: string | null
  is_current:      boolean
}

type AlumniRow = {
  id:                string
  name:              string
  email:             string | null
  cohort_fy:         string
  placed_fy:         string | null
  employment_status: string
  contact_number:    string | null
  alumni_jobs:       AlumniJob[]
}

export default async function AlumniPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'staff') redirect('/dashboard')

  const { view } = await searchParams
  const activeTab = view === 'analytics' ? 'analytics' : 'roster'

  const supabase = await createServerSupabaseClient()

  const { data: rawAlumni } = await supabase
    .from('alumni')
    .select('*, alumni_jobs(company, role, salary, starting_salary, placement_month, is_current)')
    .order('name')

  const alumni = (rawAlumni ?? []) as AlumniRow[]

  const employedCount   = alumni.filter((a) => a.employment_status === 'employed').length
  const unemployedCount = alumni.filter((a) => a.employment_status === 'unemployed').length

  const alumniRows = alumni.map((a) => {
    const job = a.alumni_jobs.find((j) => j.is_current) ?? a.alumni_jobs[0] ?? null
    return {
      id:                a.id,
      name:              a.name,
      email:             a.email,
      cohort_fy:         a.cohort_fy,
      placed_fy:         a.placed_fy,
      employment_status: a.employment_status,
      contact_number:    a.contact_number,
      company:           job?.company         ?? null,
      role:              job?.role             ?? null,
      salary:            job?.salary           ?? null,
      starting_salary:   job?.starting_salary  ?? null,
      placement_month:   job?.placement_month  ?? null,
    }
  })

  // Analytics: group placed alumni by placed_fy
  const fyMap = new Map<string, number>()
  for (const a of alumni) {
    if (a.placed_fy) {
      fyMap.set(a.placed_fy, (fyMap.get(a.placed_fy) ?? 0) + 1)
    }
  }
  const fyRows = Array.from(fyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([placed_fy, count]) => ({ placed_fy, count }))

  // Cohort view — placed counts (from alumni table, grouped by cohort_fy)
  const cohortPlacedMap = new Map<string, number>()
  for (const a of alumni) {
    if (a.cohort_fy) {
      cohortPlacedMap.set(a.cohort_fy, (cohortPlacedMap.get(a.cohort_fy) ?? 0) + 1)
    }
  }

  // Cohorts tracked in the learners table → onboarded + dropouts computed live
  const { data: rawLearners } = await supabase
    .from('learners')
    .select('cohort_fy, status')

  const learnerCohortMap = new Map<string, { onboarded: number; dropouts: number }>()
  for (const l of rawLearners ?? []) {
    if (!l.cohort_fy) continue
    const entry = learnerCohortMap.get(l.cohort_fy) ?? { onboarded: 0, dropouts: 0 }
    entry.onboarded++
    if (l.status === 'Dropout' || l.status === 'Discontinued') entry.dropouts++
    learnerCohortMap.set(l.cohort_fy, entry)
  }

  // Historical cohorts: manually entered via UI
  const { data: rawCohortStats } = await supabase
    .from('cohort_stats')
    .select('id, cohort_fy, onboarded, dropouts')
    .order('cohort_fy')

  const allCohortFys = new Set([
    ...(rawCohortStats ?? []).map((r) => r.cohort_fy as string),
    ...Array.from(learnerCohortMap.keys()),
    ...Array.from(cohortPlacedMap.keys()),
  ])

  const cohortRows = Array.from(allCohortFys)
    .sort()
    .map((cohort_fy) => {
      const fromLearners = learnerCohortMap.get(cohort_fy)
      const stat         = (rawCohortStats ?? []).find((r) => r.cohort_fy === cohort_fy)
      // Only 2025-26 is live-computed from the learners table.
      // All other cohorts use manually entered cohort_stats.
      // TODO: when a new cohort goes live, update LIVE_COHORT below.
      const LIVE_COHORT = '2025-26'
      const useLive = cohort_fy === LIVE_COHORT && !!fromLearners
      return {
        cohort_fy,
        id:           useLive ? null : (stat?.id ?? null),
        onboarded:    useLive ? (fromLearners?.onboarded ?? null) : (stat?.onboarded ?? null),
        dropouts:     useLive ? (fromLearners?.dropouts  ?? null) : (stat?.dropouts  ?? null),
        placed:       cohortPlacedMap.get(cohort_fy) ?? 0,
        autoComputed: useLive,
      }
    })

  const tabs = [
    { key: 'roster',    label: 'Roster',    href: '/alumni' },
    { key: 'analytics', label: 'Analytics', href: '/alumni?view=analytics' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Alumni</h1>
        <p className="mt-1 text-sm text-zinc-500">Placed learners across all cohorts</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Total Alumni</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{alumni.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Employed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{employedCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Unemployed</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{unemployedCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative mb-6 border-b border-zinc-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-zinc-900'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {tab.label}
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5BAE5B]" />
              )}
            </Link>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'roster' && <AlumniTable alumni={alumniRows} />}
      {activeTab === 'analytics' && <AlumniAnalytics fyRows={fyRows} cohortRows={cohortRows} />}
    </div>
  )
}
