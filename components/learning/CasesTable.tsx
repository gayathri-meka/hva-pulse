'use client'

import { useState, useEffect, useRef, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
  type FilterFn,
  type Column,
  type VisibilityState,
} from '@tanstack/react-table'
import { startCase, type TriggerInput } from '@/app/(protected)/learning/actions'
import MultiSelectChips from '@/components/ui/MultiSelectChips'
import ObservationsModal, { type Observation } from '@/components/learning/ObservationsModal'
import MetricTriggerPicker, { type MetricTriggerValue, type MetricOption as _MetricOption } from '@/components/learning/MetricTriggerPicker'

// Metric option as displayed in the triggers picker.
export type MetricOption = _MetricOption

// ── Types ──────────────────────────────────────────────────────────────────────

export type CaseRow = {
  id:                  string
  learner_id:          string
  learner_name:        string
  lf_name:             string | null
  batch_name:          string | null
  program_status:      string | null
  new_lf:              string | null
  new_batch:           string | null
  sub_cohort:          string | null
  status:              'open' | 'in_progress' | 'follow_up'
  severity:            'Low' | 'Medium' | 'High' | null
  accountable_team:    'Program' | 'Learning' | null
  step1_completed_at:  string | null
  step3_completed_at:  string | null
  root_cause_filled:   boolean
  root_cause_type:     'time' | 'learning' | 'both' | 'other' | null
  root_cause_categories: string[]
  total_interventions:  number
  done_interventions:   number
  decision_date:       string | null
  observations:        Observation[]
}

export type LearnerOption = {
  learner_id: string
  name:       string
}

interface Props {
  rows:                  CaseRow[]
  learners:              LearnerOption[]
  subCohortOptions:      string[]
  currentUserId:         string
  currentUserName:       string | null
  isAdmin:               boolean
  observationCategories: string[]
  /** Observations grouped by learner_id so the NewCaseModal can show the
      learner's recent observations as candidate triggers. */
  observationsByLearner: Record<string, Observation[]>
  /** Metric definitions for the metric-trigger picker. */
  metricOptions:         MetricOption[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const VISIBILITY_KEY = 'cases-table-col-visibility'

const LEARNER_INFO_COLS = [
  { id: 'lf_name',        label: 'LF'             },
  { id: 'batch_name',     label: 'Batch'          },
  { id: 'program_status', label: 'Program Status' },
  { id: 'new_lf',         label: 'New LF'         },
  { id: 'new_batch',      label: 'New Batch'      },
]

const CASE_COLS = [
  { id: 'learner_name',     label: 'Learner'           },
  { id: 'observations',     label: 'Observations'      },
  { id: 'status',           label: 'Status'            },
  { id: 'severity',         label: 'Severity'          },
  { id: 'accountable_team', label: 'Accountable team'  },
  { id: 'root_cause',       label: 'Root cause'        },
  { id: 'action_plan',      label: 'Action plan'       },
  { id: 'decision_date',    label: 'Decision date'     },
]

const PROGRAM_STATUS_BADGE: Record<string, string> = {
  Ongoing:          'bg-emerald-100 text-emerald-700',
  'On Hold':        'bg-orange-100 text-orange-700',
  Dropout:          'bg-red-100 text-red-700',
  Discontinued:     'bg-zinc-200 text-zinc-600',
  'Placed - Self':  'bg-blue-100 text-blue-700',
  'Placed - HVA':   'bg-violet-100 text-violet-700',
}

// ── Filters ────────────────────────────────────────────────────────────────────

const multiSelectFilter: FilterFn<CaseRow> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

const learnerSearchFilter: FilterFn<CaseRow> = (row, _, filterValue: string[]) =>
  !filterValue?.length || filterValue.includes(row.original.learner_id)
learnerSearchFilter.autoRemove = (val: string[]) => !val?.length

function FilterDropdown({ column }: { column: Column<CaseRow, unknown> }) {
  const [open, setOpen]  = useState(false)
  const containerRef     = useRef<HTMLDivElement>(null)
  const selected         = (column.getFilterValue() as string[]) ?? []

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const options = Array.from(column.getFacetedUniqueValues().keys())
    .filter((v) => v != null && v !== '')
    .map(String)
    .sort()

  function toggle(val: string) {
    const next = selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    column.setFilterValue(next.length ? next : undefined)
  }

  const label =
    selected.length === 0 ? 'All'
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`

  return (
    <div ref={containerRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded border bg-white px-2 py-0.5 text-left text-xs font-normal normal-case tracking-normal focus:outline-none ${
          selected.length ? 'border-[#5BAE5B] text-zinc-900' : 'border-zinc-200 text-zinc-500'
        }`}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3 w-3 shrink-0 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-0.5 max-h-52 min-w-[160px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => { column.setFilterValue(undefined); setOpen(false) }}
              className="w-full border-b border-zinc-100 px-3 py-1 text-left text-xs text-blue-500 hover:bg-zinc-50"
            >
              Clear filter
            </button>
          )}
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]"
              />
              <span>{opt}</span>
            </label>
          ))}
          {options.length === 0 && <p className="px-3 py-1 text-xs text-zinc-400">No values</p>}
        </div>
      )}
    </div>
  )
}

// ── New Case Modal ─────────────────────────────────────────────────────

function fmtObsDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface NewCaseModalProps {
  learners:              LearnerOption[]
  observationsByLearner: Record<string, Observation[]>
  metricOptions:         MetricOption[]
  onClose:               () => void
}

function NewCaseModal({ learners, observationsByLearner, metricOptions, onClose }: NewCaseModalProps) {
  const router                    = useRouter()
  const [query, setQuery]         = useState('')
  const [selected, setSelected]   = useState<LearnerOption | null>(null)
  const [dropOpen, setDropOpen]   = useState(false)
  const [isPending, startTrans]   = useTransition()
  const [error, setError]         = useState('')
  const inputRef                  = useRef<HTMLInputElement>(null)
  const dropRef                   = useRef<HTMLDivElement>(null)

  // Trigger picker state.
  const [obsChecked, setObsChecked]       = useState<Set<string>>(new Set())
  const [metricPicks, setMetricPicks]     = useState<MetricTriggerValue[]>([])

  const filtered = query.trim()
    ? learners.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()))
    : learners

  const learnerObservations = selected ? (observationsByLearner[selected.learner_id] ?? []) : []
  const recentObservations  = learnerObservations.slice(0, 10)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function pick(l: LearnerOption) {
    setSelected(l)
    setQuery(l.name)
    setDropOpen(false)
    setObsChecked(new Set())
    setMetricPicks([])
  }

  function toggleObs(id: string) {
    setObsChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function buildTriggers(): TriggerInput[] {
    const triggers: TriggerInput[] = []
    for (const obsId of obsChecked) {
      triggers.push({ kind: 'observation', observation_id: obsId })
    }
    for (const m of metricPicks) {
      triggers.push({
        kind:                'metric',
        metric_id:           m.metric_id,
        metric_period_label: m.metric_period_label,
        metric_value:        m.metric_value,
      })
    }
    return triggers
  }

  function handleCreate() {
    if (!selected) return
    setError('')
    startTrans(async () => {
      try {
        await startCase(selected.learner_id, buildTriggers())
        router.refresh()
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900">New case</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-500">
          Pick a learner, then anchor the case to the observations or metrics that prompted it.
        </p>

        <div ref={dropRef} className="relative">
          <input
            ref={inputRef}
            type="text"
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
            placeholder="Search learner name…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); setDropOpen(true) }}
            onFocus={() => setDropOpen(true)}
          />
          {dropOpen && filtered.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
              {filtered.map((l) => (
                <button
                  key={l.learner_id}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                  onMouseDown={(e) => { e.preventDefault(); pick(l) }}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
          {dropOpen && query.trim() && filtered.length === 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-lg">
              <p className="text-sm text-zinc-400">No learners found.</p>
            </div>
          )}
        </div>

        {selected && (
          <div className="mt-5 space-y-4">
            {/* Observations picker */}
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Triggering observations <span className="font-normal text-zinc-400">(optional)</span>
              </p>
              {recentObservations.length === 0 ? (
                <p className="text-xs text-zinc-400">No observations recorded for this learner yet.</p>
              ) : (
                <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                  {recentObservations.map((o) => (
                    <li key={o.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                          checked={obsChecked.has(o.id)}
                          onChange={() => toggleObs(o.id)}
                        />
                        <span className="min-w-0 flex-1 text-xs">
                          <span className="text-zinc-500">{fmtObsDate(o.observed_at)}</span>
                          {o.type && <span className="ml-1.5 text-zinc-500">· {o.type}</span>}
                          {o.severity && <span className="ml-1.5 text-zinc-500">· severity {o.severity}</span>}
                          <span className="mt-0.5 block whitespace-pre-wrap text-zinc-700">{o.note}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Metric trigger */}
            <div className="rounded-lg border border-zinc-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Triggering metric <span className="font-normal text-zinc-400">(optional)</span>
              </p>
              <MetricTriggerPicker
                learnerId={selected.learner_id}
                metricOptions={metricOptions}
                value={metricPicks}
                onChange={setMetricPicks}
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40"
          >
            {isPending ? 'Creating…' : 'Create case'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusLabel(row: CaseRow): string {
  const today = new Date().toISOString().slice(0, 10)
  const inMonitoring = !!row.step3_completed_at
  if (inMonitoring && row.decision_date && row.decision_date <= today) return 'Needs review'
  if (inMonitoring)         return 'Monitoring'
  if (row.step1_completed_at) return 'Pending'
  return 'Open'
}

const STATUS_RANK: Record<string, number> = {
  'Needs review': 0,
  'Open':         1,
  'Pending':      2,
  'Monitoring':   3,
}

function statusBadge(label: string): string {
  if (label === 'Needs review') return 'bg-red-50 text-red-700 border-2 border-red-500'
  if (label === 'Open')         return 'bg-red-50 text-red-600 border border-red-200'
  if (label === 'Pending')      return 'bg-amber-50 text-amber-600 border border-amber-200'
  return 'bg-blue-50 text-blue-600 border border-blue-200' // Monitoring
}

// Severity sort rank used to make the column sortable by urgency.
const SEVERITY_RANK: Record<string, number> = {
  High:   0,
  Medium: 1,
  Low:    2,
  '':     99,
}

const SEVERITY_BADGE: Record<string, string> = {
  Low:    'bg-zinc-100 text-zinc-600',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
}

function rootCauseLabel(row: CaseRow): string {
  if (!row.root_cause_filled) return 'Not filled'
  if (row.root_cause_type === 'time')     return 'Time'
  if (row.root_cause_type === 'learning') return 'Learning'
  if (row.root_cause_type === 'other')    return 'Other'
  return 'Filled'
}

function rootCauseBadge(label: string): string {
  if (label === 'Not filled') return 'bg-zinc-50 text-zinc-500 border border-zinc-200'
  if (label === 'Time')       return 'bg-sky-50 text-sky-700 border border-sky-200'
  if (label === 'Learning')   return 'bg-violet-50 text-violet-700 border border-violet-200'
  if (label === 'Other')      return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Columns ────────────────────────────────────────────────────────────────────

const col = createColumnHelper<CaseRow>()

function ObservationsCell({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={count === 0 ? 'Add observation' : `${count} observation${count !== 1 ? 's' : ''}`}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-0.5 text-xs text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50"
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
      {count > 0 && <span className="font-medium">{count}</span>}
    </button>
  )
}

function buildColumns(onOpenObservations: (row: CaseRow) => void) {
 return [
  col.accessor('learner_name', {
    id:       'learner_name',
    header:   'Learner',
    enableHiding: false,
    filterFn: learnerSearchFilter,
    cell:     (info) => (
      <Link
        href={`/learning?filter=cases&view=learner&learner=${info.row.original.learner_id}`}
        className="font-medium text-zinc-900 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor((row) => row.observations.length, {
    id:            'observations',
    header:        'Observations',
    enableSorting: true,
    cell: (info) => (
      <ObservationsCell
        count={info.row.original.observations.length}
        onClick={() => onOpenObservations(info.row.original)}
      />
    ),
  }),
  col.accessor('lf_name', {
    id:       'lf_name',
    header:   'LF',
    filterFn: multiSelectFilter,
    cell:     (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('batch_name', {
    id:       'batch_name',
    header:   'Batch',
    filterFn: multiSelectFilter,
    cell:     (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('program_status', {
    id:       'program_status',
    header:   'Program Status',
    filterFn: multiSelectFilter,
    cell: (info) => {
      const val = info.getValue()
      if (!val) return <span className="text-zinc-300">—</span>
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PROGRAM_STATUS_BADGE[val] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {val}
        </span>
      )
    },
  }),
  col.accessor('new_lf', {
    id:       'new_lf',
    header:   'New LF',
    filterFn: multiSelectFilter,
    cell:     (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('new_batch', {
    id:       'new_batch',
    header:   'New Batch',
    filterFn: multiSelectFilter,
    cell:     (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor((row) => statusLabel(row), {
    id:       'status',
    header:   'Status',
    filterFn: multiSelectFilter,
    sortingFn: (a, b) => (STATUS_RANK[statusLabel(a.original)] ?? 99) - (STATUS_RANK[statusLabel(b.original)] ?? 99),
    cell: (info) => {
      const label = info.getValue() as string
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(label)}`}>
          {label}
        </span>
      )
    },
  }),
  col.accessor((row) => row.severity ?? '', {
    id:       'severity',
    header:   'Severity',
    filterFn: multiSelectFilter,
    sortingFn: (a, b) => (SEVERITY_RANK[a.original.severity ?? ''] ?? 99) - (SEVERITY_RANK[b.original.severity ?? ''] ?? 99),
    cell: (info) => {
      const v = info.getValue() as string
      if (!v) return <span className="text-zinc-300">—</span>
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[v] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {v}
        </span>
      )
    },
  }),
  col.accessor((row) => row.accountable_team ?? '', {
    id:       'accountable_team',
    header:   'Accountable team',
    filterFn: multiSelectFilter,
    cell: (info) => {
      const v = info.getValue() as string
      return v
        ? <span className="text-xs text-zinc-700">{v}</span>
        : <span className="text-zinc-300">—</span>
    },
  }),
  col.accessor((row) => rootCauseLabel(row), {
    id:       'root_cause',
    header:   'Root cause',
    filterFn: multiSelectFilter,
    cell: (info) => {
      const r      = info.row.original
      const label  = rootCauseLabel(r)
      const cats   = r.root_cause_categories
      return (
        <div className="flex flex-col gap-1">
          <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${rootCauseBadge(label)}`}>
            {label}
          </span>
          {r.root_cause_filled && cats.length > 0 && (
            <span className="text-xs text-zinc-500">{cats.join(', ')}</span>
          )}
        </div>
      )
    },
  }),
  col.accessor((row) => row.total_interventions, {
    id:     'action_plan',
    header: 'Action plan',
    cell: (info) => {
      const r = info.row.original
      if (r.total_interventions === 0) {
        return <span className="text-xs text-zinc-400">No items</span>
      }
      return (
        <span className="text-sm tabular-nums text-zinc-700">
          {r.done_interventions}/{r.total_interventions}{' '}
          <span className="text-xs text-zinc-400">done</span>
        </span>
      )
    },
  }),
  col.accessor('decision_date', {
    id:     'decision_date',
    header: 'Decision date',
    sortingFn: (a, b) => {
      const av = a.original.decision_date ?? ''
      const bv = b.original.decision_date ?? ''
      return av.localeCompare(bv)
    },
    cell: (info) => {
      const iso = info.getValue() as string | null
      if (!iso) return <span className="text-zinc-300">—</span>
      const today = new Date().toISOString().slice(0, 10)
      const overdue = iso <= today
      return (
        <span className={`text-sm ${overdue ? 'text-amber-700 font-medium' : 'text-zinc-600'}`}>
          {fmtDate(iso)}
        </span>
      )
    },
  }),
 ]
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CasesTable({ rows, learners, subCohortOptions, currentUserId, currentUserName, isAdmin, observationCategories, observationsByLearner, metricOptions }: Props) {
  const [obsRow, setObsRow] = useState<CaseRow | null>(null)
  const columns = useMemo(() => buildColumns(setObsRow), [])
  // Default sort matches the Dashboard's case column ordering — Needs review
  // first, then Open, Pending, Monitoring (see STATUS_RANK below).
  const [sorting,          setSorting]          = useState<SortingState>([{ id: 'status', desc: false }])
  const [columnFilters,    setColumnFilters]    = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    lf_name:    false,
    batch_name: false,
    new_lf:     false,
    new_batch:  false,
  })
  const [showModal,        setShowModal]        = useState(false)
  const [showColMenu,      setShowColMenu]      = useState(false)
  const [activeSubCohorts, setActiveSubCohorts] = useState<Set<string>>(new Set())
  const [learnerFilter,    setLearnerFilter]    = useState<string[]>([])
  const colMenuRef = useRef<HTMLDivElement>(null)

  // Hydrate column visibility from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(VISIBILITY_KEY)
      if (v) setColumnVisibility(JSON.parse(v))
    } catch {}
  }, [])

  // Click-outside for column menu
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // Filter rows by sub-cohort (client-side, before passing to table)
  const filteredRows = useMemo(() => {
    if (activeSubCohorts.size === 0) return rows
    return rows.filter((r) => r.sub_cohort && activeSubCohorts.has(r.sub_cohort))
  }, [rows, activeSubCohorts])

  const table = useReactTable({
    data:    filteredRows,
    columns,
    state:   { sorting, columnFilters, columnVisibility },
    onSortingChange:       setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((old: VisibilityState) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        try { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    },
    getCoreRowModel:        getCoreRowModel(),
    getSortedRowModel:      getSortedRowModel(),
    getFilteredRowModel:    getFilteredRowModel(),
    getFacetedRowModel:     getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => row.id,
  })

  function toggleSubCohort(sc: string) {
    setActiveSubCohorts((prev) => {
      const next = new Set(prev)
      if (next.has(sc)) next.delete(sc)
      else next.add(sc)
      return next
    })
  }

  function handleLearnerFilter(ids: string[]) {
    setLearnerFilter(ids)
    table.getColumn('learner_name')?.setFilterValue(ids.length ? ids : undefined)
  }

  const filteredCount = table.getFilteredRowModel().rows.length
  const rowCountText  =
    filteredCount === rows.length
      ? `${rows.length} case${rows.length !== 1 ? 's' : ''}`
      : `${filteredCount} of ${rows.length} cases`

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Left: sub-cohort pills + learner chips */}
        <div className="flex flex-wrap items-center gap-2">
          {subCohortOptions.map((sc) => (
            <button
              key={sc}
              onClick={() => toggleSubCohort(sc)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                activeSubCohorts.has(sc)
                  ? 'border-zinc-800 bg-zinc-800 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
              }`}
            >
              {sc}
            </button>
          ))}

          <MultiSelectChips
            options={learners.map((l) => ({ id: l.learner_id, label: l.name }))}
            selectedIds={learnerFilter}
            onChange={handleLearnerFilter}
            placeholder="Search learners…"
            className="min-w-[240px]"
          />
        </div>

        {/* Right: row count + columns + new case */}
        <div className="flex items-center gap-3" ref={colMenuRef}>
          <span className="text-sm text-zinc-500">{rowCountText}</span>

          <div className="relative">
            <button
              onClick={() => setShowColMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
                <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
              </svg>
              Columns
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                <p className="mb-1 px-2.5 pt-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Learner info</p>
                {LEARNER_INFO_COLS.map(({ id, label }) => {
                  const column = table.getColumn(id)
                  if (!column) return null
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                      />
                      <span className="text-xs text-zinc-700">{label}</span>
                    </label>
                  )
                })}
                <hr className="my-1.5 border-zinc-100" />
                <p className="mb-1 px-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Case</p>
                {CASE_COLS.map(({ id, label }) => {
                  const column = table.getColumn(id)
                  if (!column) return null
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        disabled={!column.getCanHide()}
                        className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900 disabled:opacity-50"
                      />
                      <span className="text-xs text-zinc-700">{label}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            + New case
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 px-8 py-12 text-center">
          <p className="text-sm text-zinc-400">No active cases yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  {table.getFlatHeaders().map((header) => (
                    <th
                      key={header.id}
                      className="sticky top-0 z-10 bg-zinc-50 select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                    >
                      <div
                        className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  && <span className="text-zinc-400">↑</span>}
                        {header.column.getIsSorted() === 'desc' && <span className="text-zinc-400">↓</span>}
                      </div>
                      {header.column.getCanFilter() && header.column.id !== 'learner_name' && <FilterDropdown column={header.column} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <NewCaseModal
          learners={learners}
          observationsByLearner={observationsByLearner}
          metricOptions={metricOptions}
          onClose={() => setShowModal(false)}
        />
      )}

      {obsRow && (
        <ObservationsModal
          learnerId={obsRow.learner_id}
          learnerName={obsRow.learner_name}
          observations={obsRow.observations}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isAdmin={isAdmin}
          categories={observationCategories}
          onClose={() => setObsRow(null)}
        />
      )}
    </div>
  )
}
