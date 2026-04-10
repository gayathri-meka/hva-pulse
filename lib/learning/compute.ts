import type { ComputedMetric, SeriesPoint } from '@/components/learning/LearningDashboard'

// ── Types ──────────────────────────────────────────────────────────────────────

export type RawRow = {
  source_id:  string
  learner_id: string
  dimensions: Record<string, string | null>
  value:      string | null
}

export type CompositeInput = {
  metric_id:      string
  weight:         number
  summary_method: 'last' | 'avg' | 'sum' | null
}

export type MetricDef = {
  id:               string
  name:             string
  kind:             'simple' | 'composite'
  source_id:        string | null
  aggregation:      string | null
  filters:          { column: string; operator: string; value: string }[]
  time_dimension:   string | null
  time_sort_order:  string | null
  composite_inputs: CompositeInput[]
  fill_gaps:        boolean
  filter_logic:     'and' | 'or'
}

// ── Simple metric helpers ──────────────────────────────────────────────────────

export function applyFilters(rows: RawRow[], filters: MetricDef['filters'], logic: 'and' | 'or' = 'and'): RawRow[] {
  if (filters.length === 0) return rows
  const match = logic === 'and' ? 'every' : 'some'
  return rows.filter((r) =>
    filters[match]((f) => {
      const v = String(r.dimensions?.[f.column] ?? '').toLowerCase()
      const fv = f.value.toLowerCase()
      switch (f.operator) {
        case 'eq':          return v === fv
        case 'neq':         return v !== fv
        case 'starts_with': return v.startsWith(fv)
        case 'contains':    return v.includes(fv)
        default:            return true
      }
    })
  )
}

export function aggregate(rows: RawRow[], agg: string): number | null {
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

export function sortPeriods(periods: string[], sortOrder: string | null): string[] {
  const s = [...periods]
  if (sortOrder === 'numerical')          s.sort((a, b) => parseFloat(a) - parseFloat(b))
  else if (sortOrder === 'chronological') s.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  else                                    s.sort()
  return s
}

export function computeSimpleForLearner(rows: RawRow[], metric: MetricDef): ComputedMetric {
  if (!metric.aggregation) return { kind: 'single', value: null }
  const filtered = applyFilters(rows, metric.filters, metric.filter_logic)

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
  let series: SeriesPoint[] = periods.map((p) => ({
    period: p,
    value:  aggregate(groups.get(p) ?? [], metric.aggregation!),
  }))

  // Zero-fill weekly gaps when opted in (fill_gaps defaults to true).
  if (metric.fill_gaps) {
    series = zeroFillWeeklyGaps(series)
  }

  const current = series.length > 0 ? series[series.length - 1].value : null
  const prev    = series.length > 1 ? series[series.length - 2].value : null
  const delta   = current !== null && prev !== null ? current - prev : null

  return { kind: 'series', series, current, delta }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Fill missing weeks with value: 0 from the learner's first activity
 *  through the current week. Only activates when every period matches
 *  YYYY-MM-DD format. Trailing zeros after last activity surface inactivity. */
function zeroFillWeeklyGaps(series: SeriesPoint[]): SeriesPoint[] {
  if (series.length === 0) return series
  if (!series.every((s) => ISO_DATE_RE.test(s.period))) return series

  const existing = new Map(series.map((s) => [s.period, s]))
  const start    = new Date(series[0].period)

  // End at the Monday of the current week (not the learner's last activity)
  const now       = new Date()
  const dayOfWeek = now.getDay()
  const monday    = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  const end = monday

  const filled: SeriesPoint[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10)
    const real = existing.get(iso)
    filled.push(real ?? { period: iso, value: 0 })
    cursor.setDate(cursor.getDate() + 7)
  }
  return filled
}

// ── Composite metric helpers ───────────────────────────────────────────────────

/** Collapse a ComputedMetric to a scalar using the given summary method. */
export function collapseToScalar(c: ComputedMetric | undefined, method: CompositeInput['summary_method']): number | null {
  if (!c) return null
  if (c.kind === 'single') return c.value
  // series
  const vals = c.series.map((p) => p.value).filter((v): v is number => v !== null)
  if (vals.length === 0) return null
  if (method === 'last' || method === null) return vals[vals.length - 1]
  if (method === 'sum')                     return vals.reduce((a, b) => a + b, 0)
  if (method === 'avg')                     return vals.reduce((a, b) => a + b, 0) / vals.length
  return vals[vals.length - 1]
}

/**
 * Topologically sort metrics so each metric appears after all its composite dependencies.
 * Throws on cycles.
 */
export function topoSortMetrics(metrics: MetricDef[]): MetricDef[] {
  const byId    = new Map(metrics.map((m) => [m.id, m]))
  const ordered: MetricDef[] = []
  const seen    = new Set<string>()
  const visiting = new Set<string>()

  function visit(m: MetricDef) {
    if (seen.has(m.id)) return
    if (visiting.has(m.id)) throw new Error(`Composite metric cycle at "${m.name}"`)
    visiting.add(m.id)
    if (m.kind === 'composite') {
      for (const inp of m.composite_inputs) {
        const dep = byId.get(inp.metric_id)
        if (dep) visit(dep)
      }
    }
    visiting.delete(m.id)
    seen.add(m.id)
    ordered.push(m)
  }

  for (const m of metrics) visit(m)
  return ordered
}

/** Compute every metric for one learner, in topological order. */
export function computeAllForLearner(
  metricsInOrder: MetricDef[],
  rowsBySource:   Map<string, RawRow[]>,
): Record<string, ComputedMetric> {
  const out: Record<string, ComputedMetric> = {}

  for (const m of metricsInOrder) {
    if (m.kind === 'simple') {
      const rows = m.source_id ? (rowsBySource.get(m.source_id) ?? []) : []
      out[m.id] = computeSimpleForLearner(rows, m)
    } else {
      // Composite — null if any input is null
      let total: number | null = 0
      for (const inp of m.composite_inputs) {
        const scalar = collapseToScalar(out[inp.metric_id], inp.summary_method)
        if (scalar === null) { total = null; break }
        total = (total ?? 0) + scalar * inp.weight
      }
      out[m.id] = { kind: 'single', value: total }
    }
  }

  return out
}
