import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import MetricsSection, { type MetricRow } from '@/components/learning/MetricsSection'
import InterventionPanel, { type Intervention, type StaffUser } from '@/components/learning/InterventionPanel'
import type { ComputedMetric, SeriesPoint } from '@/components/learning/LearningDashboard'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ learnerId: string }>
}

// ── Types ──────────────────────────────────────────────────────────────────────

type RawRow = {
  source_id:  string
  learner_id: string
  dimensions: Record<string, string | null>
  value:      string | null
}

type MetricDef = {
  id:              string
  name:            string
  source_id:       string
  aggregation:     string
  filters:         { column: string; operator: string; value: string }[]
  time_dimension:  string | null
  time_sort_order: string | null
}

// ── Computation helpers (mirrored from learning/page.tsx) ──────────────────────

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
  if (sortOrder === 'numerical')          s.sort((a, b) => parseFloat(a) - parseFloat(b))
  else if (sortOrder === 'chronological') s.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  else                                    s.sort()
  return s
}

function computeForLearner(rows: RawRow[], metric: MetricDef): ComputedMetric {
  const filtered = applyFilters(rows, metric.filters)

  if (!metric.time_dimension) {
    return { kind: 'single', value: aggregate(filtered, metric.aggregation) }
  }

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

export default async function LearnerLearningPage({ params }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const { learnerId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: learner } = await supabase
    .from('learners')
    .select('learner_id, lf_name, batch_name, track, status, users!learners_user_id_fkey(name, email)')
    .eq('learner_id', learnerId)
    .single()

  if (!learner) redirect('/learning')

  const learnerUser = learner.users as unknown as { name: string; email: string } | null
  const name        = learnerUser?.name ?? learnerId
  const email       = learnerUser?.email?.trim().toLowerCase() ?? ''

  // Parallel fetches: metrics, raw rows, active intervention, staff users
  const [{ data: metricsRaw }, { data: rawRowsData }, { data: interventionRaw }, { data: staffRaw }] = await Promise.all([
    supabase.from('metrics').select('*').order('created_at'),
    email
      ? supabase
          .from('metric_raw_rows')
          .select('source_id, learner_id, dimensions, value')
          .eq('learner_id', email)
          .limit(10000)
      : Promise.resolve({ data: [] }),
    supabase
      .from('interventions')
      .select('id, learner_id, status, root_cause_category, root_cause_notes, step1_completed_at, action_items, step2_completed_at, resurface_date, last_reviewed_at')
      .eq('learner_id', learnerId)
      .neq('status', 'closed')
      .maybeSingle(),
    supabase.from('users').select('id, name, role').in('role', ['admin', 'LF']).order('name'),
  ])

  const metricDefs: MetricDef[] = metricsRaw ?? []
  const staffUsers: StaffUser[] = (staffRaw ?? []) as StaffUser[]
  const rawRows: RawRow[] = (rawRowsData ?? []).map((r) => ({
    source_id:  r.source_id,
    learner_id: r.learner_id,
    dimensions: (r.dimensions ?? {}) as Record<string, string | null>,
    value:      r.value,
  }))

  // Group raw rows by source for fast lookup
  const bySource = new Map<string, RawRow[]>()
  for (const row of rawRows) {
    if (!bySource.has(row.source_id)) bySource.set(row.source_id, [])
    bySource.get(row.source_id)!.push(row)
  }

  const metricRows: MetricRow[] = metricDefs.map((m) => ({
    id:       m.id,
    name:     m.name,
    computed: computeForLearner(bySource.get(m.source_id) ?? [], m),
  }))

  const intervention: Intervention | null = interventionRaw
    ? {
        id:                  interventionRaw.id,
        learner_id:          interventionRaw.learner_id,
        status:              interventionRaw.status as Intervention['status'],
        root_cause_category: interventionRaw.root_cause_category ?? null,
        root_cause_notes:    interventionRaw.root_cause_notes ?? null,
        step1_completed_at:  interventionRaw.step1_completed_at ?? null,
        action_items:        (interventionRaw.action_items ?? []) as Intervention['action_items'],
        step2_completed_at:  interventionRaw.step2_completed_at ?? null,
        resurface_date:      interventionRaw.resurface_date ?? null,
        last_reviewed_at:    interventionRaw.last_reviewed_at ?? null,
      }
    : null

  const STATUS_BADGE: Record<string, string> = {
    Ongoing:         'bg-emerald-100 text-emerald-700',
    'On Hold':       'bg-orange-100 text-orange-700',
    Dropout:         'bg-red-100 text-red-700',
    Discontinued:    'bg-zinc-200 text-zinc-600',
    'Placed - Self': 'bg-blue-100 text-blue-700',
    'Placed - HVA':  'bg-violet-100 text-violet-700',
  }
  const status   = (learner as unknown as { status: string }).status ?? null
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/learning" className="hover:text-zinc-700">Learning</Link>
        <span>/</span>
        <span>{name}</span>
      </div>

      {/* Learner info card */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-500">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-900">{name}</h1>
              <p className="text-sm text-zinc-500">{email}</p>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-400">
                <span className="font-mono">{learnerId}</span>
                {learner.batch_name && <span>{learner.batch_name}</span>}
                {learner.lf_name    && <span>LF: {learner.lf_name}</span>}
                {learner.track      && <span>{learner.track}</span>}
              </div>
            </div>
          </div>
          {status && (
            <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Metrics */}
      {metricRows.length > 0 && (
        <div className="mb-6">
          <MetricsSection metrics={metricRows} />
        </div>
      )}

      {/* Intervention */}
      <InterventionPanel learnerId={learnerId} intervention={intervention} staffUsers={staffUsers} />
    </div>
  )
}
