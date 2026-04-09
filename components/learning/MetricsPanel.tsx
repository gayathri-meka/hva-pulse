'use client'

import { useState, useTransition, useEffect } from 'react'
import { createMetricDef, updateMetricDef, deleteMetricDef, getDistinctDimensionValues } from '@/app/(protected)/learning/actions'

// ── Types ──────────────────────────────────────────────────────────────────────

export type SourceColumn = {
  id: string
  column_name: string
  role: string
  label: string | null
}

export type Source = {
  id: string
  name: string
  metric_source_columns: SourceColumn[]
}

export type MetricDef = {
  id: string
  name: string
  source_id: string
  aggregation: string
  filters: { column: string; operator: string; value: string }[]
  description: string | null
  time_dimension: string | null
  time_sort_order: string | null
}

interface Props {
  metrics: MetricDef[]
  sources: Source[]
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function MetricsPanel({ metrics, sources }: Props) {
  const [adding,  setAdding]  = useState(false)
  const [editing, setEditing] = useState<MetricDef | null>(null)
  const [, startTransition] = useTransition()

  function handleDelete(m: MetricDef) {
    if (!confirm(`Delete "${m.name}"? This cannot be undone.`)) return
    startTransition(async () => { await deleteMetricDef(m.id) })
  }

  const sourceMap = Object.fromEntries(sources.map((s) => [s.id, s.name]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Defined Metrics
        </span>
      </div>

      {metrics.length === 0 ? (
        <p className="text-sm text-zinc-400">No metrics defined yet.</p>
      ) : (
        <div className="space-y-2.5">
          {metrics.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-zinc-900">{m.name}</div>
                {m.description && (
                  <div className="mt-0.5 text-xs text-zinc-500">{m.description}</div>
                )}
              </div>

              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                m.time_dimension
                  ? 'bg-[#EEEDFE] text-[#3C3489]'
                  : 'bg-zinc-50 border border-zinc-200 text-zinc-500'
              }`}>
                {m.time_dimension ? 'tracked over time' : 'single value'}
              </span>

              <button
                onClick={() => setEditing(m)}
                className="shrink-0 text-xs text-zinc-400 hover:text-zinc-700"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(m)}
                className="shrink-0 text-xs text-red-400 hover:text-red-600"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setAdding(true)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
      >
        <span className="text-base leading-none">+</span>
        Add metric
      </button>

      {adding && (
        <MetricModal sources={sources} sourceMap={sourceMap} onClose={() => setAdding(false)} />
      )}
      {editing && (
        <MetricModal
          sources={sources}
          sourceMap={sourceMap}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

type Filter = { column: string; value: string }

function MetricModal({
  sources,
  sourceMap,
  existing,
  onClose,
}: {
  sources: Source[]
  sourceMap: Record<string, string>
  existing?: MetricDef
  onClose: () => void
}) {
  const isEdit = !!existing
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [name,       setName]       = useState(existing?.name ?? '')
  const [sourceId,   setSourceId]   = useState(existing?.source_id ?? '')
  const [aggregation, setAggregation] = useState(existing?.aggregation ?? 'COUNT')
  const [filters,    setFilters]    = useState<Filter[]>(
    existing?.filters?.map((f) => ({ column: f.column, value: f.value })) ?? []
  )
  const [trackTime,  setTrackTime]  = useState(!!existing?.time_dimension)
  const [timeDim,    setTimeDim]    = useState(existing?.time_dimension ?? '')
  const [timeSortOrder, setTimeSortOrder] = useState<'alphabetical' | 'chronological' | 'numerical'>(
    (existing?.time_sort_order as 'alphabetical' | 'chronological' | 'numerical') ?? 'alphabetical'
  )
  const [distinctValues, setDistinctValues] = useState<string[]>([])
  const [loadingValues, setLoadingValues] = useState(false)

  // Track if user has changed the source — only then reset dependent fields
  const initialSourceId = existing?.source_id ?? ''
  const sourceChanged   = isEdit && sourceId !== initialSourceId

  const selectedSource = sources.find((s) => s.id === sourceId)
  const dimensions = selectedSource?.metric_source_columns.filter((c) => c.role === 'dimension') ?? []

  // Reset filters + time when source actually changes (not on initial mount)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    if (!mounted) return
    setFilters([])
    setTrackTime(false)
    setTimeDim('')
    setDistinctValues([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId])

  // Fetch distinct values when time dimension column is picked
  useEffect(() => {
    if (!sourceId || !timeDim) { setDistinctValues([]); return }
    setLoadingValues(true)
    startTransition(async () => {
      try {
        const vals = await getDistinctDimensionValues(sourceId, timeDim)
        setDistinctValues(vals)
      } catch {
        setDistinctValues([])
      } finally {
        setLoadingValues(false)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, timeDim])

  function addFilter() {
    const firstDim = dimensions[0]
    if (!firstDim) return
    setFilters((f) => [...f, { column: firstDim.column_name, value: '' }])
  }

  function updateFilter(i: number, field: keyof Filter, val: string) {
    setFilters((f) => f.map((r, idx) => idx === i ? { ...r, [field]: val } : r))
  }

  function removeFilter(i: number) {
    setFilters((f) => f.filter((_, idx) => idx !== i))
  }

  function labelFor(colName: string) {
    return dimensions.find((d) => d.column_name === colName)?.label ?? colName
  }

  // Live plain-English preview
  function buildDescription(): string {
    if (!sourceId || !aggregation) return ''
    const parts: string[] = [aggregation]
    parts.push(sourceMap[sourceId] ?? sourceId)
    for (const f of filters) {
      if (f.column && f.value.trim()) {
        parts.push(`${labelFor(f.column)} = ${f.value.trim()}`)
      }
    }
    if (trackTime && timeDim) {
      parts.push(`tracked over time by ${labelFor(timeDim)}`)
    }
    return parts.join(' · ')
  }

  const description = buildDescription()

  function handleSave() {
    if (!name.trim())   { setError('Name is required'); return }
    if (!sourceId)      { setError('Pick a data source'); return }
    if (trackTime && !timeDim) { setError('Pick a time dimension'); return }

    const cleanFilters = filters
      .filter((f) => f.column && f.value.trim())
      .map((f) => ({ column: f.column, operator: 'eq', value: f.value.trim() }))

    const payload = {
      name:          name.trim(),
      sourceId,
      aggregation,
      filters:       cleanFilters,
      timeDimension: trackTime ? timeDim : null,
      timeSortOrder: trackTime ? timeSortOrder : null,
      description,
    }

    startTransition(async () => {
      try {
        if (isEdit && existing) {
          await updateMetricDef(existing.id, payload)
        } else {
          await createMetricDef(payload)
        }
        onClose()
      } catch (e) {
        setError(String(e))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-zinc-900">
          {isEdit ? 'Edit metric' : 'Add metric'}
        </h2>

        {isEdit && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Editing this metric will change the values shown across all dashboards and learner pages.
            {sourceChanged && ' Filters and time dimension have been reset because you changed the data source.'}
          </div>
        )}

        <div className="space-y-4">

          {/* Name */}
          <Field label="Metric name">
            <input
              autoFocus
              className={inputCls}
              placeholder="e.g. English attendance"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          {/* Source */}
          <Field label="Data source">
            <SelectBox value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Select a source…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </SelectBox>
          </Field>

          {sourceId && (
            <>
              {/* Aggregation */}
              <Field label="Aggregation">
                <div className="flex gap-2">
                  {AGGREGATIONS.map((agg) => (
                    <button
                      key={agg}
                      onClick={() => setAggregation(agg)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        aggregation === agg
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      }`}
                    >
                      {agg}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Filters */}
              {dimensions.length > 0 && (
                <Field label="Filters (optional)">
                  <div className="space-y-2">
                    {filters.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <SelectBox
                          className="flex-1"
                          value={f.column}
                          onChange={(e) => updateFilter(i, 'column', e.target.value)}
                        >
                          {dimensions.map((d) => (
                            <option key={d.column_name} value={d.column_name}>
                              {d.label ?? d.column_name}
                            </option>
                          ))}
                        </SelectBox>
                        <span className="shrink-0 text-xs text-zinc-400">=</span>
                        <input
                          className={`${inputCls} flex-1`}
                          placeholder="value"
                          value={f.value}
                          onChange={(e) => updateFilter(i, 'value', e.target.value)}
                        />
                        <button
                          onClick={() => removeFilter(i)}
                          className="shrink-0 text-zinc-400 hover:text-red-500"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addFilter}
                      className="text-xs text-zinc-500 hover:text-zinc-700"
                    >
                      + Add filter
                    </button>
                  </div>
                </Field>
              )}

              {/* Time dimension toggle */}
              {dimensions.length > 0 && (
                <div className="rounded-lg border border-zinc-200 px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <div
                      onClick={() => { setTrackTime((v) => !v); setTimeDim(''); setDistinctValues([]) }}
                      className={`relative h-5 w-9 rounded-full transition-colors ${
                        trackTime ? 'bg-[#5BAE5B]' : 'bg-zinc-200'
                      }`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                        trackTime ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </div>
                    <span className="text-sm font-medium text-zinc-700">Track over time</span>
                  </label>

                  {trackTime && (
                    <div className="mt-3 space-y-3">
                      {/* Time dimension picker */}
                      <Field label="Time dimension">
                        <SelectBox value={timeDim} onChange={(e) => setTimeDim(e.target.value)}>
                          <option value="">Select dimension…</option>
                          {dimensions.map((d) => (
                            <option key={d.column_name} value={d.column_name}>
                              {d.label ?? d.column_name}
                            </option>
                          ))}
                        </SelectBox>
                      </Field>

                      {/* Distinct values preview */}
                      {timeDim && (
                        <div className="text-xs text-zinc-500">
                          {loadingValues ? (
                            <span className="text-zinc-400">Loading values…</span>
                          ) : distinctValues.length > 0 ? (
                            <>
                              <span className="text-zinc-400">Detected: </span>
                              {distinctValues.map((v, i) => (
                                <span key={v}>
                                  <span className="font-mono">{v}</span>
                                  {i < distinctValues.length - 1 && <span className="text-zinc-300">, </span>}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="text-zinc-400">No values found — make sure the source is synced.</span>
                          )}
                        </div>
                      )}

                      {/* Sort order */}
                      <Field label="Sort order">
                        <div className="flex gap-2">
                          {SORT_ORDERS.map(({ key, label }) => (
                            <button
                              key={key}
                              onClick={() => setTimeSortOrder(key)}
                              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                timeSortOrder === key
                                  ? 'bg-zinc-900 text-white'
                                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Live preview */}
          {description && (
            <div className="rounded-lg bg-zinc-50 px-4 py-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">Preview</p>
              <p className="text-sm text-zinc-700">{description}</p>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className={cancelBtn}>Cancel</button>
          <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Save metric'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-zinc-500">{label}</label>
      {children}
    </div>
  )
}

function SelectBox({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={`relative ${className}`}>
      <select
        {...props}
        className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
      >
        {children}
      </select>
      <svg
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
      >
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
      </svg>
    </div>
  )
}

const AGGREGATIONS = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] as const

const SORT_ORDERS = [
  { key: 'alphabetical'  as const, label: 'Alphabetical' },
  { key: 'chronological' as const, label: 'Chronological' },
  { key: 'numerical'     as const, label: 'Numerical' },
]

const inputCls   = 'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'
const primaryBtn = 'rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50'
const cancelBtn  = 'rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50'
