import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import LearningDashboard, {
  type ComputedMetric,
  type LearnerRow,
  type MetricCol,
  type SeriesPoint,
} from '@/components/learning/LearningDashboard'
import InterventionPanel, { type Intervention, type StaffUser } from '@/components/learning/InterventionPanel'
import LearnerSearchBox from '@/components/learning/LearnerSearchBox'
import MetricsSection, { type MetricRow } from '@/components/learning/MetricsSection'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ filter?: string; lf?: string; sub_cohort?: string; learner?: string }>
}

// ── Types ──────────────────────────────────────────────────────────────────────

type RawRow = {
  source_id: string
  learner_id: string
  dimensions: Record<string, string | null>
  value: string | null
}

type MetricDef = {
  id: string
  name: string
  source_id: string
  aggregation: string
  filters: { column: string; operator: string; value: string }[]
  time_dimension: string | null
  time_sort_order: string | null
}

// ── Computation helpers ────────────────────────────────────────────────────────

function applyFilters(rows: RawRow[], filters: MetricDef['filters']): RawRow[] {
  return rows.filter((r) =>
    filters.every((f) => {
      const v = String(r.dimensions?.[f.column] ?? '')
      return f.operator === 'eq' ? v === f.value : true
    })
  )
}

function aggregate(rows: RawRow[], agg: string): number | null {
  if (agg === 'COUNT') return rows.length > 0 ? rows.length : null
  const nums = rows.flatMap((r) => {
    const n = parseFloat(r.value ?? '')
    return isNaN(n) ? [] : [n]
  })
  if (nums.length === 0) return null
  if (agg === 'SUM') return nums.reduce((a, b) => a + b, 0)
  if (agg === 'AVG') return nums.reduce((a, b) => a + b, 0) / nums.length
  if (agg === 'MIN') return Math.min(...nums)
  if (agg === 'MAX') return Math.max(...nums)
  return null
}

function sortPeriods(periods: string[], sortOrder: string | null): string[] {
  const s = [...periods]
  if (sortOrder === 'numerical')     s.sort((a, b) => parseFloat(a) - parseFloat(b))
  else if (sortOrder === 'chronological') s.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  else s.sort() // alphabetical
  return s
}

function computeForLearner(rows: RawRow[], metric: MetricDef): ComputedMetric {
  const filtered = applyFilters(rows, metric.filters)

  if (!metric.time_dimension) {
    return { kind: 'single', value: aggregate(filtered, metric.aggregation) }
  }

  // Group by time dimension
  const groups = new Map<string, RawRow[]>()
  for (const row of filtered) {
    const period = String(row.dimensions?.[metric.time_dimension] ?? '').trim()
    if (!period) continue
    if (!groups.has(period)) groups.set(period, [])
    groups.get(period)!.push(row)
  }

  const periods = sortPeriods(Array.from(groups.keys()), metric.time_sort_order)
  const series: SeriesPoint[] = periods.map((p) => ({
    period: p,
    value:  aggregate(groups.get(p) ?? [], metric.aggregation),
  }))

  const current = series.length > 0 ? series[series.length - 1].value : null
  const prev    = series.length > 1 ? series[series.length - 2].value : null
  const delta   = current !== null && prev !== null ? current - prev : null

  return { kind: 'series', series, current, delta }
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default async function LearningPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const { filter = 'all', lf, sub_cohort, learner: selectedLearnerId } = await searchParams
  const subCohorts = sub_cohort ? sub_cohort.split(',').filter(Boolean) : []
  const supabase = await createServerSupabaseClient()
  const isLF = appUser.role === 'LF'

  // Learners (active cohort, with email via users join)
  const learnersQuery = (() => {
    let q = supabase
      .from('learners')
      .select('learner_id, lf_name, lf_user_id, batch_name, sub_cohort, status, new_lf, new_batch, new_mentor, users!learners_user_id_fkey(name, email)')
      .eq('cohort_fy', '2025-26')
      .order('lf_name')
    if (isLF)            q = q.eq('lf_user_id', appUser.id)
    else if (lf)         q = q.eq('lf_name', lf)
    if (subCohorts.length) q = q.in('sub_cohort', subCohorts)
    return q
  })()

  // Fetch all learners for sub_cohort pill options (unfiltered)
  const [
    { data: learnersRaw },
    { data: metricsRaw },
    { data: allLearners },
    { data: interventionsRaw },
  ] = await Promise.all([
    learnersQuery,
    supabase.from('metrics').select('*').order('created_at'),
    supabase.from('learners').select('sub_cohort').eq('cohort_fy', '2025-26'),
    supabase.from('interventions').select('id, learner_id, status, resurface_date').neq('status', 'closed'),
  ])

  const interventionMap = new Map(
    (interventionsRaw ?? []).map((iv) => [iv.learner_id, iv as { id: string; learner_id: string; status: string; resurface_date: string | null }])
  )

  const subCohortOptions = Array.from(
    new Set((allLearners ?? []).map((l) => l.sub_cohort).filter(Boolean))
  ).sort() as string[]

  const learners  = learnersRaw ?? []
  const metricDefs: MetricDef[] = metricsRaw ?? []

  // Compute metric values for every learner
  let learnerRows: LearnerRow[] = []

  if (filter === 'all' && metricDefs.length > 0) {
    const emails = learners
      .map((l) => (l.users as unknown as { email: string } | null)?.email?.trim().toLowerCase())
      .filter((e): e is string => !!e)

    const sourceIds = [...new Set(metricDefs.map((m) => m.source_id))]

    // Fetch all raw rows in pages — Supabase caps single queries at db.max_rows (default 1000)
    const PAGE = 1000
    const rawRowsData: { source_id: string; learner_id: string; dimensions: unknown; value: string | null }[] = []
    let offset = 0
    while (true) {
      const { data: page } = await supabase
        .from('metric_raw_rows')
        .select('source_id, learner_id, dimensions, value')
        .in('source_id', sourceIds)
        .in('learner_id', emails)
        .range(offset, offset + PAGE - 1)
      if (!page || page.length === 0) break
      rawRowsData.push(...page)
      if (page.length < PAGE) break
      offset += PAGE
    }

    const rawRows: RawRow[] = rawRowsData.map((r) => ({
      source_id:  r.source_id,
      learner_id: r.learner_id,
      dimensions: (r.dimensions ?? {}) as Record<string, string | null>,
      value:      r.value,
    }))

    // Group raw rows by source → learner for fast lookup
    const bySourceLearner = new Map<string, RawRow[]>()
    for (const row of rawRows) {
      const key = `${row.source_id}::${row.learner_id}`
      if (!bySourceLearner.has(key)) bySourceLearner.set(key, [])
      bySourceLearner.get(key)!.push(row)
    }

    learnerRows = learners.map((l) => {
      const user  = l.users as unknown as { name: string; email: string } | null
      const email = user?.email?.trim().toLowerCase() ?? ''
      const name  = user?.name ?? l.learner_id

      const metrics: Record<string, ComputedMetric> = {}
      for (const metric of metricDefs) {
        const rows = bySourceLearner.get(`${metric.source_id}::${email}`) ?? []
        metrics[metric.id] = computeForLearner(rows, metric)
      }

      return {
        learner_id:   l.learner_id,
        name,
        lf_name:      l.lf_name ?? null,
        batch_name:   l.batch_name ?? null,
        status:       (l as unknown as { status: string }).status ?? null,
        new_lf:       (l as unknown as { new_lf: string | null }).new_lf ?? null,
        new_batch:    (l as unknown as { new_batch: string | null }).new_batch ?? null,
        new_mentor:   (l as unknown as { new_mentor: string | null }).new_mentor ?? null,
        metrics,
        intervention: interventionMap.get(l.learner_id) ?? null,
      }
    })
  } else if (filter === 'all') {
    // No metrics defined — still show learner list (empty metric columns)
    learnerRows = learners.map((l) => {
      const user = l.users as unknown as { name: string; email: string } | null
      return {
        learner_id:   l.learner_id,
        name:         user?.name ?? l.learner_id,
        lf_name:      l.lf_name ?? null,
        batch_name:   l.batch_name ?? null,
        status:       (l as unknown as { status: string }).status ?? null,
        new_lf:       (l as unknown as { new_lf: string | null }).new_lf ?? null,
        new_batch:    (l as unknown as { new_batch: string | null }).new_batch ?? null,
        new_mentor:   (l as unknown as { new_mentor: string | null }).new_mentor ?? null,
        metrics:      {},
        intervention: interventionMap.get(l.learner_id) ?? null,
      }
    })
  }

  // Sort: "Needs review" (monitoring + overdue) first, then other active, then no intervention
  const today = new Date().toISOString().slice(0, 10)
  learnerRows.sort((a, b) => {
    const score = (iv: LearnerRow['intervention']) => {
      if (!iv) return 3
      if (iv.status === 'monitoring' && iv.resurface_date && iv.resurface_date <= today) return 0
      if (iv.status === 'monitoring') return 1
      return 2
    }
    return score(a.intervention) - score(b.intervention)
  })

  const metricCols: MetricCol[] = metricDefs.map((m) => ({
    id:            m.id,
    name:          m.name,
    is_time_series: !!m.time_dimension,
  }))

  // ── Interventions tab data ─────────────────────────────────────────────────
  type CohortLearner = { learner_id: string; name: string; email: string }
  type SelectedLearnerData = {
    learner_id: string; name: string; email: string
    batch_name: string | null; lf_name: string | null; status: string | null
  }

  let cohortLearners: CohortLearner[] = []
  let staffUsers: StaffUser[] = []
  let selectedLearnerData: SelectedLearnerData | null = null
  let selectedIntervention: Intervention | null = null
  let selectedMetricRows: MetricRow[] = []

  if (filter === 'interventions') {
    const [{ data: allCohort }, { data: staff }] = await Promise.all([
      supabase
        .from('learners')
        .select('learner_id, users!learners_user_id_fkey(name, email)')
        .eq('cohort_fy', '2025-26')
        .order('lf_name'),
      supabase.from('users').select('id, name, role').in('role', ['admin', 'LF']).order('name'),
    ])

    cohortLearners = (allCohort ?? []).map((l) => {
      const u = l.users as unknown as { name: string; email: string } | null
      return { learner_id: l.learner_id, name: u?.name ?? l.learner_id, email: u?.email ?? '' }
    })
    staffUsers = (staff ?? []) as StaffUser[]

    if (selectedLearnerId) {
      const [{ data: sl }, { data: iv }] = await Promise.all([
        supabase
          .from('learners')
          .select('learner_id, lf_name, batch_name, status, users!learners_user_id_fkey(name, email)')
          .eq('learner_id', selectedLearnerId)
          .single(),
        supabase
          .from('interventions')
          .select('id, learner_id, status, root_cause_category, root_cause_notes, step1_completed_at, action_items, step2_completed_at, resurface_date, last_reviewed_at')
          .eq('learner_id', selectedLearnerId)
          .neq('status', 'closed')
          .maybeSingle(),
      ])

      if (sl) {
        const u = sl.users as unknown as { name: string; email: string } | null
        const slEmail = u?.email?.trim().toLowerCase() ?? ''
        selectedLearnerData = {
          learner_id: sl.learner_id,
          name:       u?.name ?? sl.learner_id,
          email:      slEmail,
          batch_name: sl.batch_name ?? null,
          lf_name:    sl.lf_name ?? null,
          status:     (sl as unknown as { status: string }).status ?? null,
        }

        // Fetch + compute metrics for this learner
        if (slEmail && metricDefs.length > 0) {
          const { data: rawRowsData } = await supabase
            .from('metric_raw_rows')
            .select('source_id, learner_id, dimensions, value')
            .eq('learner_id', slEmail)
            .limit(10000)

          const rawRows: RawRow[] = (rawRowsData ?? []).map((r) => ({
            source_id:  r.source_id,
            learner_id: r.learner_id,
            dimensions: (r.dimensions ?? {}) as Record<string, string | null>,
            value:      r.value,
          }))
          const bySource = new Map<string, RawRow[]>()
          for (const row of rawRows) {
            if (!bySource.has(row.source_id)) bySource.set(row.source_id, [])
            bySource.get(row.source_id)!.push(row)
          }
          selectedMetricRows = metricDefs.map((m) => ({
            id:       m.id,
            name:     m.name,
            computed: computeForLearner(bySource.get(m.source_id) ?? [], m),
          }))
        }
      }

      if (iv) {
        selectedIntervention = {
          id:                  iv.id,
          learner_id:          iv.learner_id,
          status:              iv.status as Intervention['status'],
          root_cause_category: iv.root_cause_category ?? null,
          root_cause_notes:    iv.root_cause_notes ?? null,
          step1_completed_at:  iv.step1_completed_at ?? null,
          action_items:        (iv.action_items ?? []) as Intervention['action_items'],
          step2_completed_at:  iv.step2_completed_at ?? null,
          resurface_date:      iv.resurface_date ?? null,
          last_reviewed_at:    iv.last_reviewed_at ?? null,
        }
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Learning</h1>
      </div>

      {/* Top-level tabs */}
      <div className="mb-6 flex items-center gap-1 border-b border-zinc-200">
        {[
          { key: 'all',           label: 'Dashboard',     href: `/learning?filter=all${lf ? `&lf=${lf}` : ''}` },
          { key: 'interventions', label: 'Interventions', href: `/learning?filter=interventions${lf ? `&lf=${lf}` : ''}` },
          ...(appUser.role === 'admin' ? [{ key: 'settings', label: 'Settings', href: '/learning/settings' }] : []),
        ].map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className={`relative pb-3 px-1 mr-4 text-sm font-medium transition-colors ${
              filter === key ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {filter === key && <span className="absolute bottom-0 left-0 h-0.5 w-full bg-[#5BAE5B]" />}
          </Link>
        ))}
      </div>

      {filter === 'all' && (
        <LearningDashboard learners={learnerRows} metrics={metricCols} subCohortOptions={subCohortOptions} />
      )}

      {filter === 'interventions' && (
        <div className="space-y-6">
          {/* Learner search */}
          <LearnerSearchBox learners={cohortLearners} selectedId={selectedLearnerId ?? null} />

          {/* Selected learner view */}
          {selectedLearnerData && (
            <div className="space-y-6">
              {/* Learner info card */}
              <LearnerInfoCard learner={selectedLearnerData} />

              {/* Metrics */}
              {selectedMetricRows.length > 0 && (
                <MetricsSection metrics={selectedMetricRows} />
              )}

              {/* Intervention */}
              <InterventionPanel
                learnerId={selectedLearnerData.learner_id}
                intervention={selectedIntervention}
                staffUsers={staffUsers}
              />
            </div>
          )}

          {!selectedLearnerId && (
            <p className="text-sm text-zinc-400">Select a learner to view or start an intervention.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Learner info card ─────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  Ongoing:          'bg-emerald-100 text-emerald-700',
  'On Hold':        'bg-orange-100 text-orange-700',
  Dropout:          'bg-red-100 text-red-700',
  Discontinued:     'bg-zinc-200 text-zinc-600',
  'Placed - Self':  'bg-blue-100 text-blue-700',
  'Placed - HVA':   'bg-violet-100 text-violet-700',
}

function LearnerInfoCard({ learner }: {
  learner: { learner_id: string; name: string; email: string; batch_name: string | null; lf_name: string | null; status: string | null }
}) {
  const initials = learner.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-500">
            {initials}
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900">{learner.name}</h2>
            <p className="text-sm text-zinc-500">{learner.email}</p>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-400">
              <span className="font-mono">{learner.learner_id}</span>
              {learner.batch_name && <span>{learner.batch_name}</span>}
              {learner.lf_name    && <span>LF: {learner.lf_name}</span>}
            </div>
          </div>
        </div>
        {learner.status && (
          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[learner.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {learner.status}
          </span>
        )}
      </div>
    </div>
  )
}
