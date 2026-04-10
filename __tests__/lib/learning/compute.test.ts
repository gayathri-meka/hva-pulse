import { describe, it, expect } from 'vitest'
import {
  applyFilters,
  aggregate,
  sortPeriods,
  computeSimpleForLearner,
  collapseToScalar,
  topoSortMetrics,
  computeAllForLearner,
  type RawRow,
  type MetricDef,
} from '@/lib/learning/compute'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<RawRow> = {}): RawRow {
  return { source_id: 's1', learner_id: 'a@b.com', dimensions: {}, value: null, ...overrides }
}

function makeMetric(overrides: Partial<MetricDef> = {}): MetricDef {
  return {
    id: 'm1', name: 'Test', kind: 'simple',
    source_id: 's1', aggregation: 'COUNT',
    filters: [], time_dimension: null, time_sort_order: null,
    composite_inputs: [], fill_gaps: false, filter_logic: 'and',
    ...overrides,
  }
}

// ── applyFilters ─────────────────────────────────────────────────────────────

describe('applyFilters', () => {
  const rows: RawRow[] = [
    makeRow({ dimensions: { course: 'Python', week: 'W1' } }),
    makeRow({ dimensions: { course: 'React', week: 'W1' } }),
    makeRow({ dimensions: { course: 'Python', week: 'W2' } }),
  ]

  it('returns all rows when no filters', () => {
    expect(applyFilters(rows, [])).toHaveLength(3)
  })

  it('filters with eq (case-insensitive)', () => {
    const result = applyFilters(rows, [{ column: 'course', operator: 'eq', value: 'python' }])
    expect(result).toHaveLength(2)
  })

  it('filters with neq', () => {
    const result = applyFilters(rows, [{ column: 'course', operator: 'neq', value: 'Python' }])
    expect(result).toHaveLength(1)
    expect(result[0].dimensions.course).toBe('React')
  })

  it('filters with starts_with', () => {
    const result = applyFilters(rows, [{ column: 'course', operator: 'starts_with', value: 'Py' }])
    expect(result).toHaveLength(2)
  })

  it('filters with contains', () => {
    const result = applyFilters(rows, [{ column: 'course', operator: 'contains', value: 'act' }])
    expect(result).toHaveLength(1)
    expect(result[0].dimensions.course).toBe('React')
  })

  it('AND logic: all filters must match', () => {
    const result = applyFilters(
      rows,
      [
        { column: 'course', operator: 'eq', value: 'Python' },
        { column: 'week', operator: 'eq', value: 'W2' },
      ],
      'and'
    )
    expect(result).toHaveLength(1)
  })

  it('OR logic: any filter can match', () => {
    const result = applyFilters(
      rows,
      [
        { column: 'course', operator: 'eq', value: 'React' },
        { column: 'week', operator: 'eq', value: 'W2' },
      ],
      'or'
    )
    expect(result).toHaveLength(2)
  })
})

// ── aggregate ────────────────────────────────────────────────────────────────

describe('aggregate', () => {
  const rows = [
    makeRow({ value: '10' }),
    makeRow({ value: '20' }),
    makeRow({ value: '30' }),
  ]

  it('COUNT returns row count', () => {
    expect(aggregate(rows, 'COUNT')).toBe(3)
  })

  it('COUNT returns null for empty', () => {
    expect(aggregate([], 'COUNT')).toBeNull()
  })

  it('SUM adds values', () => {
    expect(aggregate(rows, 'SUM')).toBe(60)
  })

  it('AVG averages values', () => {
    expect(aggregate(rows, 'AVG')).toBe(20)
  })

  it('MIN returns minimum', () => {
    expect(aggregate(rows, 'MIN')).toBe(10)
  })

  it('MAX returns maximum', () => {
    expect(aggregate(rows, 'MAX')).toBe(30)
  })

  it('ignores non-numeric values', () => {
    const mixed = [makeRow({ value: '10' }), makeRow({ value: 'abc' }), makeRow({ value: '30' })]
    expect(aggregate(mixed, 'SUM')).toBe(40)
  })

  it('returns null when all values non-numeric (except COUNT)', () => {
    const bad = [makeRow({ value: 'abc' })]
    expect(aggregate(bad, 'SUM')).toBeNull()
    expect(aggregate(bad, 'COUNT')).toBe(1)
  })
})

// ── sortPeriods ──────────────────────────────────────────────────────────────

describe('sortPeriods', () => {
  it('sorts alphabetically by default', () => {
    expect(sortPeriods(['C', 'A', 'B'], null)).toEqual(['A', 'B', 'C'])
  })

  it('sorts numerically', () => {
    expect(sortPeriods(['10', '2', '1'], 'numerical')).toEqual(['1', '2', '10'])
  })

  it('sorts chronologically', () => {
    const periods = ['2026-03-01', '2026-01-01', '2026-02-01']
    expect(sortPeriods(periods, 'chronological')).toEqual([
      '2026-01-01', '2026-02-01', '2026-03-01',
    ])
  })
})

// ── computeSimpleForLearner ──────────────────────────────────────────────────

describe('computeSimpleForLearner', () => {
  it('returns single value for non-time-series', () => {
    const rows = [makeRow({ value: '5' }), makeRow({ value: '3' })]
    const metric = makeMetric({ aggregation: 'SUM' })
    const result = computeSimpleForLearner(rows, metric)
    expect(result).toEqual({ kind: 'single', value: 8 })
  })

  it('returns series for time-series metric', () => {
    const rows = [
      makeRow({ dimensions: { week: '2026-01-06' }, value: '2' }),
      makeRow({ dimensions: { week: '2026-01-06' }, value: '3' }),
      makeRow({ dimensions: { week: '2026-01-13' }, value: '1' }),
    ]
    const metric = makeMetric({
      aggregation: 'SUM', time_dimension: 'week',
      time_sort_order: 'chronological', fill_gaps: false,
    })
    const result = computeSimpleForLearner(rows, metric)
    expect(result.kind).toBe('series')
    if (result.kind === 'series') {
      expect(result.series).toHaveLength(2)
      expect(result.series[0]).toEqual({ period: '2026-01-06', value: 5 })
      expect(result.series[1]).toEqual({ period: '2026-01-13', value: 1 })
      expect(result.current).toBe(1)
      expect(result.delta).toBe(-4)
    }
  })

  it('zero-fills weekly gaps when fill_gaps is true', () => {
    const rows = [
      makeRow({ dimensions: { week: '2026-01-06' }, value: '5' }),
      makeRow({ dimensions: { week: '2026-01-20' }, value: '3' }),
    ]
    const metric = makeMetric({
      aggregation: 'SUM', time_dimension: 'week',
      time_sort_order: 'chronological', fill_gaps: true,
    })
    const result = computeSimpleForLearner(rows, metric)
    if (result.kind === 'series') {
      // Should have at least 3 entries: Jan 6, Jan 13 (zero-filled), Jan 20
      // Plus trailing zeros to current week
      const jan6  = result.series.find((s) => s.period === '2026-01-06')
      const jan13 = result.series.find((s) => s.period === '2026-01-13')
      const jan20 = result.series.find((s) => s.period === '2026-01-20')
      expect(jan6?.value).toBe(5)
      expect(jan13?.value).toBe(0)
      expect(jan20?.value).toBe(3)
    }
  })

  it('does not zero-fill when fill_gaps is false', () => {
    const rows = [
      makeRow({ dimensions: { week: '2026-01-06' }, value: '5' }),
      makeRow({ dimensions: { week: '2026-01-20' }, value: '3' }),
    ]
    const metric = makeMetric({
      aggregation: 'SUM', time_dimension: 'week',
      time_sort_order: 'chronological', fill_gaps: false,
    })
    const result = computeSimpleForLearner(rows, metric)
    if (result.kind === 'series') {
      expect(result.series).toHaveLength(2)
    }
  })

  it('applies filters before aggregation', () => {
    const rows = [
      makeRow({ dimensions: { course: 'Python' }, value: '10' }),
      makeRow({ dimensions: { course: 'React' }, value: '20' }),
    ]
    const metric = makeMetric({
      aggregation: 'SUM',
      filters: [{ column: 'course', operator: 'eq', value: 'Python' }],
    })
    const result = computeSimpleForLearner(rows, metric)
    expect(result).toEqual({ kind: 'single', value: 10 })
  })
})

// ── collapseToScalar ─────────────────────────────────────────────────────────

describe('collapseToScalar', () => {
  it('returns value from single metric', () => {
    expect(collapseToScalar({ kind: 'single', value: 42 }, null)).toBe(42)
  })

  it('returns null from null single', () => {
    expect(collapseToScalar({ kind: 'single', value: null }, null)).toBeNull()
  })

  it('returns last value from series', () => {
    const m = { kind: 'series' as const, series: [
      { period: 'W1', value: 1 }, { period: 'W2', value: 5 },
    ], current: 5, delta: 4 }
    expect(collapseToScalar(m, 'last')).toBe(5)
  })

  it('returns avg from series', () => {
    const m = { kind: 'series' as const, series: [
      { period: 'W1', value: 2 }, { period: 'W2', value: 4 },
    ], current: 4, delta: 2 }
    expect(collapseToScalar(m, 'avg')).toBe(3)
  })

  it('returns sum from series', () => {
    const m = { kind: 'series' as const, series: [
      { period: 'W1', value: 2 }, { period: 'W2', value: 4 },
    ], current: 4, delta: 2 }
    expect(collapseToScalar(m, 'sum')).toBe(6)
  })
})

// ── topoSortMetrics ──────────────────────────────────────────────────────────

describe('topoSortMetrics', () => {
  it('puts simples before composites', () => {
    const metrics: MetricDef[] = [
      makeMetric({ id: 'comp', kind: 'composite', composite_inputs: [{ metric_id: 'simple', weight: 1, summary_method: null }] }),
      makeMetric({ id: 'simple', kind: 'simple' }),
    ]
    const sorted = topoSortMetrics(metrics)
    expect(sorted.map((m) => m.id)).toEqual(['simple', 'comp'])
  })

  it('handles composite depending on composite', () => {
    const metrics: MetricDef[] = [
      makeMetric({ id: 'c2', kind: 'composite', composite_inputs: [{ metric_id: 'c1', weight: 1, summary_method: null }] }),
      makeMetric({ id: 'c1', kind: 'composite', composite_inputs: [{ metric_id: 's1', weight: 1, summary_method: null }] }),
      makeMetric({ id: 's1', kind: 'simple' }),
    ]
    const sorted = topoSortMetrics(metrics)
    const ids = sorted.map((m) => m.id)
    expect(ids.indexOf('s1')).toBeLessThan(ids.indexOf('c1'))
    expect(ids.indexOf('c1')).toBeLessThan(ids.indexOf('c2'))
  })

  it('throws on cycles', () => {
    const metrics: MetricDef[] = [
      makeMetric({ id: 'a', kind: 'composite', composite_inputs: [{ metric_id: 'b', weight: 1, summary_method: null }] }),
      makeMetric({ id: 'b', kind: 'composite', composite_inputs: [{ metric_id: 'a', weight: 1, summary_method: null }] }),
    ]
    expect(() => topoSortMetrics(metrics)).toThrow(/cycle/i)
  })
})

// ── computeAllForLearner ─────────────────────────────────────────────────────

describe('computeAllForLearner', () => {
  it('computes simple + composite together', () => {
    const metrics: MetricDef[] = [
      makeMetric({ id: 's1', kind: 'simple', source_id: 'src', aggregation: 'SUM' }),
      makeMetric({ id: 's2', kind: 'simple', source_id: 'src', aggregation: 'SUM',
        filters: [{ column: 'type', operator: 'eq', value: 'B' }] }),
      makeMetric({ id: 'comp', kind: 'composite', composite_inputs: [
        { metric_id: 's1', weight: 0.6, summary_method: null },
        { metric_id: 's2', weight: 0.4, summary_method: null },
      ]}),
    ]
    const rows: RawRow[] = [
      makeRow({ source_id: 'src', dimensions: { type: 'A' }, value: '10' }),
      makeRow({ source_id: 'src', dimensions: { type: 'B' }, value: '20' }),
    ]
    const bySource = new Map([['src', rows]])
    const sorted = topoSortMetrics(metrics)
    const result = computeAllForLearner(sorted, bySource)

    expect(result.s1).toEqual({ kind: 'single', value: 30 })  // 10+20
    expect(result.s2).toEqual({ kind: 'single', value: 20 })  // only type=B
    expect(result.comp).toEqual({ kind: 'single', value: 30 * 0.6 + 20 * 0.4 }) // 18+8=26
  })

  it('returns null for composite when any input is null', () => {
    const metrics: MetricDef[] = [
      makeMetric({ id: 's1', kind: 'simple', source_id: 'src', aggregation: 'SUM' }),
      makeMetric({ id: 'comp', kind: 'composite', composite_inputs: [
        { metric_id: 's1', weight: 1, summary_method: null },
        { metric_id: 'missing', weight: 1, summary_method: null },
      ]}),
    ]
    const rows = [makeRow({ source_id: 'src', value: '10' })]
    const bySource = new Map([['src', rows]])
    const sorted = topoSortMetrics(metrics)
    const result = computeAllForLearner(sorted, bySource)

    expect(result.comp).toEqual({ kind: 'single', value: null })
  })
})
