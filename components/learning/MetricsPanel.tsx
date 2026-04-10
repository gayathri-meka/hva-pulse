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

export type CompositeInput = {
  metric_id:      string
  weight:         number
  summary_method: 'last' | 'avg' | 'sum' | null
}

export type MetricDef = {
  id: string
  name: string
  kind: 'simple' | 'composite'
  source_id: string | null
  aggregation: string | null
  filters: { column: string; operator: string; value: string }[]
  description: string | null
  time_dimension: string | null
  time_sort_order: string | null
  composite_inputs: CompositeInput[]
  fill_gaps: boolean
  filter_logic: 'and' | 'or'
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
  const metricMap = Object.fromEntries(metrics.map((m) => [m.id, m]))

  const simpleMetrics    = metrics.filter((m) => m.kind === 'simple')
  const compositeMetrics = metrics.filter((m) => m.kind === 'composite')

  function renderMetric(m: MetricDef) {
    return (
      <div
        key={m.id}
        className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4"
      >
        {/* Icon tile */}
        {m.kind === 'simple' ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EEEDFE]">
            {/* HeroIcon: chart-bar */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4 text-[#3C3489]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FEF3C7]">
            {/* HeroIcon: squares-plus (layers/combine) */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-4 w-4 text-[#92400E]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 16.875h3.375m0 0h3.375m-3.375 0V13.5m0 3.375v3.375M6 10.5h2.25a2.25 2.25 0 0 0 2.25-2.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v2.25A2.25 2.25 0 0 0 6 10.5Zm0 9.75h2.25A2.25 2.25 0 0 0 10.5 18v-2.25a2.25 2.25 0 0 0-2.25-2.25H6a2.25 2.25 0 0 0-2.25 2.25V18A2.25 2.25 0 0 0 6 20.25Zm9.75-9.75H18a2.25 2.25 0 0 0 2.25-2.25V6A2.25 2.25 0 0 0 18 3.75h-2.25A2.25 2.25 0 0 0 13.5 6v2.25a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-zinc-900">{m.name}</div>
          {m.description && (
            <div className="mt-0.5 text-xs text-zinc-500">{m.description}</div>
          )}
        </div>

        {m.kind === 'simple' ? (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            m.time_dimension
              ? 'bg-[#EEEDFE] text-[#3C3489]'
              : 'bg-zinc-50 border border-zinc-200 text-zinc-500'
          }`}>
            {m.time_dimension ? 'tracked over time' : 'single value'}
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-xs font-medium text-[#92400E]">
            composite
          </span>
        )}

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
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Defined Metrics
        </span>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          <span className="text-base leading-none">+</span>
          Add metric
        </button>
      </div>

      {/* Simple metrics */}
      <div className="space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Simple metrics
        </span>
        {simpleMetrics.length === 0 ? (
          <p className="text-sm text-zinc-400">No simple metrics defined yet.</p>
        ) : (
          <div className="space-y-2.5">{simpleMetrics.map(renderMetric)}</div>
        )}
      </div>

      {/* Composite metrics */}
      <div className="space-y-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Composite metrics
        </span>
        {compositeMetrics.length === 0 ? (
          <p className="text-sm text-zinc-400">No composite metrics defined yet.</p>
        ) : (
          <div className="space-y-2.5">{compositeMetrics.map(renderMetric)}</div>
        )}
      </div>

      {adding && (
        <MetricModal
          sources={sources}
          sourceMap={sourceMap}
          allMetrics={metrics}
          metricMap={metricMap}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <MetricModal
          sources={sources}
          sourceMap={sourceMap}
          allMetrics={metrics}
          metricMap={metricMap}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ── Modal ──────────────────────────────────────────────────────────────────────

type Filter = { column: string; operator: string; value: string }

function MetricModal({
  sources,
  sourceMap,
  allMetrics,
  metricMap,
  existing,
  onClose,
}: {
  sources: Source[]
  sourceMap: Record<string, string>
  allMetrics: MetricDef[]
  metricMap: Record<string, MetricDef>
  existing?: MetricDef
  onClose: () => void
}) {
  const isEdit = !!existing
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const [kind, setKind] = useState<'simple' | 'composite'>(existing?.kind ?? 'simple')

  const [name,       setName]       = useState(existing?.name ?? '')
  const [sourceId,   setSourceId]   = useState(existing?.source_id ?? '')
  const [aggregation, setAggregation] = useState(existing?.aggregation ?? 'COUNT')
  const [filters,    setFilters]    = useState<Filter[]>(
    existing?.filters?.map((f) => ({ column: f.column, operator: f.operator ?? 'eq', value: f.value })) ?? []
  )

  // Composite state
  const [compositeInputs, setCompositeInputs] = useState<CompositeInput[]>(
    existing?.composite_inputs ?? []
  )
  const [manualDescription, setManualDescription] = useState(existing?.description ?? '')
  const [trackTime,    setTrackTime]    = useState(!!existing?.time_dimension)
  const [fillGaps,     setFillGaps]     = useState(existing?.fill_gaps ?? true)
  const [filterLogic,  setFilterLogic]  = useState<'and' | 'or'>(existing?.filter_logic ?? 'and')
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
    setFilters((f) => [...f, { column: firstDim.column_name, operator: 'eq', value: '' }])
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

  // Live plain-English preview (simple)
  function buildDescription(): string {
    if (!sourceId || !aggregation) return ''
    const parts: string[] = [aggregation]
    parts.push(sourceMap[sourceId] ?? sourceId)
    for (const f of filters) {
      if (f.column && f.value.trim()) {
        parts.push(`${labelFor(f.column)} ${FILTER_OP_SYMBOL[f.operator] ?? '='} ${f.value.trim()}`)
      }
    }
    if (trackTime && timeDim) {
      parts.push(`tracked over time by ${labelFor(timeDim)}`)
    }
    return parts.join(' · ')
  }

  // Live formula preview (composite)
  function buildFormula(): string {
    const parts = compositeInputs
      .filter((ci) => ci.metric_id)
      .map((ci) => {
        const m = metricMap[ci.metric_id]
        if (!m) return ''
        const isSeries = m.kind === 'simple' && !!m.time_dimension
        const wrap = isSeries
          ? `${(ci.summary_method ?? 'last').toUpperCase()}(${m.name})`
          : m.name
        return `${wrap} × ${ci.weight}`
      })
      .filter(Boolean)
    return parts.join(' + ')
  }

  const description = kind === 'simple' ? buildDescription() : (manualDescription || buildFormula())

  function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }

    if (kind === 'simple') {
      if (!sourceId)             { setError('Pick a data source'); return }
      if (trackTime && !timeDim) { setError('Pick a time dimension'); return }

      const cleanFilters = filters
        .filter((f) => f.column && f.value.trim())
        .map((f) => ({ column: f.column, operator: f.operator, value: f.value.trim() }))

      const payload = {
        kind:          'simple' as const,
        name:          name.trim(),
        sourceId,
        aggregation,
        filters:       cleanFilters,
        timeDimension: trackTime ? timeDim : null,
        timeSortOrder: trackTime ? timeSortOrder : null,
        fillGaps:      trackTime ? fillGaps : true,
        filterLogic,
        description,
      }
      runSave(payload)
      return
    }

    // composite
    const valid = compositeInputs.filter((ci) => ci.metric_id && Number.isFinite(ci.weight))
    if (valid.length === 0) { setError('Add at least one input'); return }
    for (const ci of valid) {
      const m = metricMap[ci.metric_id]
      if (!m) { setError('Invalid input metric'); return }
      if (m.kind === 'simple' && m.time_dimension && !ci.summary_method) {
        setError(`Pick a summary method for "${m.name}"`)
        return
      }
    }
    runSave({
      kind:            'composite' as const,
      name:            name.trim(),
      description,
      compositeInputs: valid,
    })
  }

  function runSave(payload: Parameters<typeof createMetricDef>[0]) {
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
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6">
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

          {/* Kind toggle */}
          {!isEdit && (
            <div className="flex gap-2">
              {(['simple', 'composite'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                    kind === k
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                  }`}
                >
                  {k === 'simple' ? 'Simple metric' : 'Composite metric'}
                </button>
              ))}
            </div>
          )}

          {/* Name */}
          <Field label="Metric name">
            <input
              autoFocus
              className={inputCls}
              placeholder={kind === 'simple' ? 'e.g. English attendance' : 'e.g. Engagement score'}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          {/* ── Composite mode ──────────────────────────────────────────── */}
          {kind === 'composite' && (
            <CompositeEditor
              allMetrics={allMetrics.filter((m) => !existing || m.id !== existing.id)}
              metricMap={metricMap}
              inputs={compositeInputs}
              setInputs={setCompositeInputs}
              description={manualDescription}
              setDescription={setManualDescription}
            />
          )}

          {/* ── Simple mode ─────────────────────────────────────────────── */}
          {kind === 'simple' && (
          <Field label="Data source">
            <SelectBox value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Select a source…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </SelectBox>
          </Field>
          )}

          {kind === 'simple' && sourceId && (
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
                    {filters.length >= 2 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-zinc-400">Join:</span>
                        {(['and', 'or'] as const).map((logic) => (
                          <button
                            key={logic}
                            onClick={() => setFilterLogic(logic)}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium uppercase transition-colors ${
                              filterLogic === logic
                                ? 'bg-zinc-900 text-white'
                                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                            }`}
                          >
                            {logic}
                          </button>
                        ))}
                      </div>
                    )}
                    {filters.map((f, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <SelectBox
                          className="min-w-0 flex-1"
                          value={f.column}
                          onChange={(e) => updateFilter(i, 'column', e.target.value)}
                        >
                          {dimensions.map((d) => (
                            <option key={d.column_name} value={d.column_name}>
                              {d.label ?? d.column_name}
                            </option>
                          ))}
                        </SelectBox>
                        <SelectBox
                          className="w-28 shrink-0"
                          value={f.operator}
                          onChange={(e) => updateFilter(i, 'operator', e.target.value)}
                        >
                          {FILTER_OPERATORS.map((op) => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </SelectBox>
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
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                    >
                      <span className="text-base leading-none">+</span> Add filter
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

                      {/* Fill gaps */}
                      <label className="flex cursor-pointer items-center gap-2.5 pt-1">
                        <input
                          type="checkbox"
                          checked={fillGaps}
                          onChange={(e) => setFillGaps(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                        />
                        <span className="text-xs text-zinc-700">Fill weekly gaps with 0</span>
                      </label>
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

function CompositeEditor({
  allMetrics,
  metricMap,
  inputs,
  setInputs,
  description,
  setDescription,
}: {
  allMetrics:     MetricDef[]
  metricMap:      Record<string, MetricDef>
  inputs:         CompositeInput[]
  setInputs:      (updater: (prev: CompositeInput[]) => CompositeInput[]) => void
  description:    string
  setDescription: (val: string) => void
}) {
  function addInput() {
    setInputs((prev) => [...prev, { metric_id: '', weight: 1, summary_method: null }])
  }
  function updateInput(i: number, patch: Partial<CompositeInput>) {
    setInputs((prev) => prev.map((ci, idx) => (idx === i ? { ...ci, ...patch } : ci)))
  }
  function removeInput(i: number) {
    setInputs((prev) => prev.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-3">
      <Field label="Description (optional)">
        <input
          className={inputCls}
          placeholder="What does this score represent?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Inputs">
        <div className="space-y-2">
          {inputs.map((ci, i) => {
            const m = ci.metric_id ? metricMap[ci.metric_id] : null
            const isSeries = m?.kind === 'simple' && !!m.time_dimension
            return (
              <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                <div className="flex items-center gap-2">
                  <SelectBox
                    className="min-w-0 flex-1"
                    value={ci.metric_id}
                    onChange={(e) => {
                      const next = e.target.value
                      const nextMetric = metricMap[next]
                      const nextIsSeries = nextMetric?.kind === 'simple' && !!nextMetric.time_dimension
                      updateInput(i, {
                        metric_id:      next,
                        summary_method: nextIsSeries ? (ci.summary_method ?? 'last') : null,
                      })
                    }}
                  >
                    <option value="">Pick a metric…</option>
                    {allMetrics.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </SelectBox>
                  <span className="shrink-0 text-xs text-zinc-400">×</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-16 shrink-0 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
                    value={ci.weight}
                    onChange={(e) => updateInput(i, { weight: parseFloat(e.target.value) || 0 })}
                  />
                  <button
                    onClick={() => removeInput(i)}
                    className="shrink-0 text-zinc-300 hover:text-red-500"
                  >
                    ×
                  </button>
                </div>
                {isSeries && (
                  <div className="flex gap-1.5 pt-0.5">
                    {(['last', 'avg', 'sum'] as const).map((sm) => (
                      <button
                        key={sm}
                        onClick={() => updateInput(i, { summary_method: sm })}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors ${
                          ci.summary_method === sm
                            ? 'bg-zinc-900 text-white'
                            : 'bg-white border border-zinc-200 text-zinc-500 hover:bg-zinc-100'
                        }`}
                      >
                        {sm === 'last' ? 'Last value' : sm === 'avg' ? 'Average' : 'Sum'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          <button
            onClick={addInput}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
          >
            <span className="text-base leading-none">+</span> Add input
          </button>
        </div>
      </Field>
    </div>
  )
}

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

const FILTER_OPERATORS = [
  { value: 'eq',          label: '=' },
  { value: 'neq',         label: '≠' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'contains',    label: 'contains' },
] as const

const FILTER_OP_SYMBOL: Record<string, string> = {
  eq: '=', neq: '≠', starts_with: 'starts with', contains: 'contains',
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
