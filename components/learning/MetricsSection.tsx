'use client'

import { useState } from 'react'
import type { ComputedMetric, SeriesPoint } from './LearningDashboard'

export type MetricRow = {
  id:       string
  name:     string
  computed: ComputedMetric
}

interface Props {
  metrics: MetricRow[]
}

export default function MetricsSection({ metrics }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    metrics.length > 0 ? metrics[0].id : null
  )

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 px-6 py-8 text-center">
        <p className="text-sm text-zinc-400">No metrics defined yet.</p>
      </div>
    )
  }

  const selected = metrics.find((m) => m.id === selectedId) ?? null

  return (
    <div className="flex overflow-hidden rounded-xl border border-zinc-200 bg-white">
      {/* Left: metric list */}
      <div className="w-52 shrink-0 border-r border-zinc-100">
        <div className="border-b border-zinc-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Metrics</p>
        </div>
        <div className="divide-y divide-zinc-50">
          {metrics.map((m) => {
            const val = m.computed.kind === 'single' ? m.computed.value : m.computed.current
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 ${
                  m.id === selectedId ? 'bg-zinc-50' : ''
                }`}
              >
                <span className={`truncate text-sm ${m.id === selectedId ? 'font-medium text-zinc-900' : 'text-zinc-600'}`}>
                  {m.name}
                </span>
                <span className={`ml-2 shrink-0 font-mono text-xs ${val === null ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {val !== null ? fmtNum(val) : '—'}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: chart or value */}
      <div className="min-w-0 flex-1 px-6 py-5">
        {selected ? (
          <MetricDetail metric={selected} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-400">Select a metric</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Metric detail ──────────────────────────────────────────────────────────────

function MetricDetail({ metric }: { metric: MetricRow }) {
  const { computed } = metric

  if (computed.kind === 'single') {
    return (
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{metric.name}</p>
        <p className="text-4xl font-bold tabular-nums text-zinc-900">
          {computed.value !== null ? fmtNum(computed.value) : '—'}
        </p>
        <p className="mt-1 text-xs text-zinc-400">Single value</p>
      </div>
    )
  }

  if (computed.series.length === 0) {
    return (
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{metric.name}</p>
        <p className="text-sm text-zinc-400">No data yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{metric.name}</p>
        {computed.current !== null && (
          <span className="text-2xl font-bold tabular-nums text-zinc-900">{fmtNum(computed.current)}</span>
        )}
        {computed.delta !== null && computed.delta !== 0 && (
          <span className={`text-sm font-medium ${computed.delta > 0 ? 'text-[#639922]' : 'text-[#E24B4A]'}`}>
            {computed.delta > 0 ? '↑' : '↓'}{fmtNum(Math.abs(computed.delta))}
          </span>
        )}
      </div>
      <BarChart series={computed.series} />
    </div>
  )
}

// ── Bar chart ──────────────────────────────────────────────────────────────────

function BarChart({ series }: { series: SeriesPoint[] }) {
  const values = series.map((p) => p.value ?? 0)
  const max    = Math.max(...values, 1)
  const min    = Math.min(...values)
  const range  = max - min

  const H    = 120
  const barW = 32
  const gap  = 10
  const totalW = series.length * (barW + gap) - gap

  // Reserve space for value labels above bars and rotated labels below
  const topPad = 16
  const labelH = 80

  return (
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
                <text
                  x={lx}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#71717a"
                >
                  {p.value !== null ? fmtNum(p.value) : ''}
                </text>
              </g>
            )
          })}
        </svg>
        {/* HTML vertical x-axis labels — sit below the SVG */}
        {series.map((p, i) => {
          const x = i * (barW + gap) + barW / 2
          return (
            <div
              key={i}
              className="absolute origin-top-left whitespace-nowrap text-[10px] text-zinc-500"
              style={{
                left:      x,
                top:       topPad + H + 8,
                transform: 'rotate(60deg) translateX(2px)',
              }}
            >
              {p.period}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(1)
}
