'use client'

import { useEffect, useState, useTransition } from 'react'
import { computeLearnerMetric } from '@/app/(protected)/learning/actions'
import type { ComputedMetric, SeriesPoint } from './LearningDashboard'

// Picker for metric triggers. Lets staff attach one or many metrics:
// - pick a metric from the dropdown
// - preview its chart for the selected learner
// - click "Attach this metric" to add it to the list
// - rinse and repeat for additional metrics
//
// Already-attached metrics are filtered out of the dropdown to avoid
// duplicates. Each attached metric can be removed from the running list
// before the caller commits the triggers.

export type MetricOption = { id: string; name: string }

export type MetricTriggerValue = {
  metric_id:           string
  metric_period_label: string | null
  metric_value:        number | null
}

interface Props {
  learnerId:     string
  metricOptions: MetricOption[]
  value:         MetricTriggerValue[]
  onChange:      (v: MetricTriggerValue[]) => void
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1)
}

export default function MetricTriggerPicker({ learnerId, metricOptions, value, onChange }: Props) {
  const [metricId, setMetricId] = useState<string>('')
  const [computed, setComputed] = useState<ComputedMetric | null>(null)
  const [loadError, setLoadError] = useState<string>('')
  const [isLoading, startLoad]    = useTransition()

  useEffect(() => {
    if (!metricId) { setComputed(null); setLoadError(''); return }
    setLoadError('')
    setComputed(null)
    startLoad(async () => {
      try {
        const c = await computeLearnerMetric(learnerId, metricId)
        setComputed(c)
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    })
  }, [learnerId, metricId])

  const attachedIds = new Set(value.map((v) => v.metric_id))
  const availableOptions = metricOptions.filter((m) => !attachedIds.has(m.id))

  function attachCurrent() {
    if (!metricId) return
    onChange([
      ...value,
      { metric_id: metricId, metric_period_label: null, metric_value: null },
    ])
    setMetricId('')
  }

  function removeAttached(id: string) {
    onChange(value.filter((v) => v.metric_id !== id))
  }

  return (
    <div className="space-y-3">
      {/* Already-attached metrics */}
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((v) => {
            const name = metricOptions.find((m) => m.id === v.metric_id)?.name ?? v.metric_id
            return (
              <li key={v.metric_id} className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                <div className="min-w-0 text-xs">
                  <span className="font-medium text-zinc-900">{name}</span>
                  {v.metric_period_label && (
                    <span className="text-zinc-600"> · {v.metric_period_label}</span>
                  )}
                  {v.metric_value !== null && (
                    <span className="text-zinc-500"> · <span className="font-mono">{fmtNum(v.metric_value)}</span></span>
                  )}
                </div>
                <button
                  onClick={() => removeAttached(v.metric_id)}
                  className="shrink-0 text-xs text-zinc-500 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {/* Picker for the next metric. Hides when there's nothing left to add. */}
      {availableOptions.length === 0 && value.length > 0 ? (
        <p className="text-xs text-zinc-400">All metrics already attached.</p>
      ) : (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-500">
            {value.length === 0 ? 'Metric' : 'Add another metric'}
          </label>
          <div className="relative">
            <select
              value={metricId}
              onChange={(e) => setMetricId(e.target.value)}
              className="w-full appearance-none rounded-lg border border-zinc-200 bg-white py-1.5 pl-2.5 pr-7 text-xs text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
            >
              <option value="">Pick a metric…</option>
              {availableOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-400">▾</span>
          </div>
        </div>
      )}

      {metricId && (
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          {isLoading && (
            <p className="py-6 text-center text-xs text-zinc-400">Loading metric…</p>
          )}
          {!isLoading && loadError && (
            <p className="py-2 text-xs text-red-600">{loadError}</p>
          )}
          {!isLoading && !loadError && computed === null && (
            <p className="py-6 text-center text-xs text-zinc-400">No data for this metric.</p>
          )}
          {!isLoading && !loadError && computed && (
            <>
              <MetricChart computed={computed} />
              <button
                onClick={attachCurrent}
                className="mt-3 w-full rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
              >
                Attach this metric
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline metric chart ────────────────────────────────────────────────────────
// Used by the picker (preview) and by trigger displays in the case panel.
// Adapted from MetricsSection.BarChart — read-only, no click handlers.

export function MetricChart({ computed }: { computed: ComputedMetric }) {
  if (computed.kind === 'single') {
    return (
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Current value</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">
          {computed.value !== null ? fmtNum(computed.value) : '—'}
        </p>
      </div>
    )
  }
  if (computed.series.length === 0) {
    return <p className="py-4 text-center text-xs text-zinc-400">No data yet.</p>
  }
  return <BarChart series={computed.series} current={computed.current} delta={computed.delta} />
}

function BarChart({ series, current, delta }: {
  series:  SeriesPoint[]
  current: number | null
  delta:   number | null
}) {
  const values = series.map((p) => p.value ?? 0)
  const max    = Math.max(...values, 1)
  const min    = Math.min(...values)
  const range  = max - min

  const H      = 110
  const barW   = 28
  const gap    = 10
  const totalW = series.length * (barW + gap) - gap
  const topPad = 16
  const labelH = 70

  return (
    <div>
      {current !== null && (
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums text-zinc-900">{fmtNum(current)}</span>
          {delta !== null && delta !== 0 && (
            <span className={`text-xs font-medium ${delta > 0 ? 'text-[#639922]' : 'text-[#E24B4A]'}`}>
              {delta > 0 ? '↑' : '↓'}{fmtNum(Math.abs(delta))}
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="relative" style={{ width: totalW + 20, height: topPad + H + labelH + 12 }}>
          <svg width={totalW} height={topPad + H + 4} className="overflow-visible">
            {series.map((p, i) => {
              const v    = p.value ?? 0
              const pos  = range === 0 ? 0.5 : (v - min) / range
              const barH = Math.max(4, Math.round(pos * (H - 12)) + 4)
              const x    = i * (barW + gap)
              const y    = topPad + H - barH
              const fill = pos >= 0.67 ? '#639922' : pos >= 0.33 ? '#EF9F27' : '#E24B4A'
              const lx   = x + barW / 2
              return (
                <g key={i}>
                  <rect x={x} y={y} width={barW} height={barH} rx={3} fill={fill} opacity={0.85} />
                  <text x={lx} y={y - 5} textAnchor="middle" fontSize={10} fill="#71717a">
                    {p.value !== null ? fmtNum(p.value) : ''}
                  </text>
                </g>
              )
            })}
          </svg>
          {series.map((p, i) => {
            const x = i * (barW + gap) + barW / 2
            return (
              <div
                key={i}
                className="absolute origin-top-left whitespace-nowrap text-[10px] text-zinc-500"
                style={{ left: x, top: topPad + H + 8, transform: 'rotate(60deg) translateX(2px)' }}
              >
                {p.period}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Convenience wrapper that fetches the computed metric on its own and renders
// the chart. Used by the trigger row when a metric is attached to a case.
export function MetricChartLoader({ learnerId, metricId }: { learnerId: string; metricId: string }) {
  const [computed, setComputed] = useState<ComputedMetric | null>(null)
  const [err, setErr]           = useState<string>('')
  const [isLoading, startLoad]  = useTransition()

  useEffect(() => {
    setErr('')
    setComputed(null)
    startLoad(async () => {
      try {
        const c = await computeLearnerMetric(learnerId, metricId)
        setComputed(c)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      }
    })
  }, [learnerId, metricId])

  if (isLoading) return <p className="py-3 text-center text-xs text-zinc-400">Loading…</p>
  if (err)       return <p className="py-2 text-xs text-red-600">{err}</p>
  if (!computed) return <p className="py-3 text-center text-xs text-zinc-400">No data.</p>
  return <MetricChart computed={computed} />
}
