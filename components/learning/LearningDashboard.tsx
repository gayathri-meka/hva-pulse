'use client'

import { useState, useEffect, useRef, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { startIntervention } from '@/app/(protected)/learning/actions'
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
  type ColumnSizingState,
  type ColumnOrderState,
  type Header,
} from '@tanstack/react-table'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Shared types ───────────────────────────────────────────────────────────────

export type SeriesPoint    = { period: string; value: number | null }
export type ComputedMetric =
  | { kind: 'single'; value: number | null }
  | { kind: 'series'; series: SeriesPoint[]; current: number | null; delta: number | null }

export type LearnerRow = {
  learner_id:   string
  name:         string
  lf_name:      string | null
  batch_name:   string | null
  status:       string | null
  new_lf:       string | null
  new_batch:    string | null
  new_mentor:   string | null
  metrics:      Record<string, ComputedMetric>
  intervention: { id: string; status: string; resurface_date: string | null } | null
}

export type MetricCol = {
  id:             string
  name:           string
  is_time_series: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────────

const VISIBILITY_KEY = 'learning-dashboard-col-visibility'
const SIZING_KEY     = 'learning-dashboard-col-sizing'
const ORDER_KEY      = 'learning-dashboard-col-order'

const STATUS_BADGE: Record<string, string> = {
  Ongoing:          'bg-emerald-100 text-emerald-700',
  'On Hold':        'bg-orange-100 text-orange-700',
  Dropout:          'bg-red-100 text-red-700',
  Discontinued:     'bg-zinc-200 text-zinc-600',
  'Placed - Self':  'bg-blue-100 text-blue-700',
  'Placed - HVA':   'bg-violet-100 text-violet-700',
}

// ── Filters ────────────────────────────────────────────────────────────────────

const multiSelectFilter: FilterFn<LearnerRow> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

const nameSearchFilter: FilterFn<LearnerRow> = (row, _, filterValue: string) =>
  !filterValue || row.original.name.toLowerCase().includes(filterValue.toLowerCase())
nameSearchFilter.autoRemove = (val: string) => !val

function FilterDropdown({ column }: { column: Column<LearnerRow, unknown> }) {
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
        <div className="absolute left-0 top-full z-20 mt-0.5 max-h-52 min-w-[140px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg">
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

// ── Intervention cell ──────────────────────────────────────────────────────────

function InterventionCell({ row }: { row: LearnerRow }) {
  const router = useRouter()
  const [isPending, startTransitionFn] = useTransition()
  const today = new Date().toISOString().slice(0, 10)
  const { intervention } = row

  if (intervention === null) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-zinc-300">—</span>
        <button
          onClick={() => startTransitionFn(async () => {
            try { await startIntervention(row.learner_id); router.refresh() } catch {}
          })}
          disabled={isPending}
          className="opacity-0 rounded border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 transition-opacity hover:border-zinc-300 group-hover:opacity-100 disabled:opacity-50"
        >
          {isPending ? '…' : 'Start'}
        </button>
      </div>
    )
  }

  const needsReview =
    intervention.status === 'monitoring' &&
    intervention.resurface_date !== null &&
    intervention.resurface_date <= today

  const label =
    needsReview                               ? 'Needs review'
    : intervention.status === 'open'          ? 'Open'
    : intervention.status === 'in_progress'   ? 'In progress'
    : 'Monitoring'

  const cls =
    needsReview
      ? 'bg-amber-50 text-amber-700 border-2 border-amber-400'
      : intervention.status === 'open'
      ? 'bg-red-50 text-red-600 border border-red-200'
      : 'bg-amber-50 text-amber-600 border border-amber-200'

  return (
    <Link
      href={`/learning?filter=interventions&learner=${row.learner_id}`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75 ${cls}`}
    >
      {label}
    </Link>
  )
}

// ── Column definitions ─────────────────────────────────────────────────────────

const col = createColumnHelper<LearnerRow>()

const LEARNER_INFO_COLS = [
  { id: 'lf_name',    label: 'LF'         },
  { id: 'batch_name', label: 'Batch'      },
  { id: 'status',     label: 'Status'     },
  { id: 'new_lf',     label: 'New LF'     },
  { id: 'new_batch',  label: 'New Batch'  },
  { id: 'new_mentor', label: 'New Mentor' },
]

const fixedColumns = [
  col.accessor('name', {
    id:           'name',
    header:       'Learner',
    enableHiding: false,
    filterFn:     nameSearchFilter,
    cell: (info) => (
      <Link
        href={`/learning?filter=interventions&view=learner&learner=${info.row.original.learner_id}`}
        className="font-medium text-zinc-900 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor('lf_name', {
    id:       'lf_name',
    header:   'LF',
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('batch_name', {
    id:       'batch_name',
    header:   'Batch',
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('status', {
    id:       'status',
    header:   'Status',
    filterFn: multiSelectFilter,
    cell: (info) => {
      const val = info.getValue()
      if (!val) return <span className="text-zinc-300">—</span>
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[val] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {val}
        </span>
      )
    },
  }),
  col.accessor('new_lf', {
    id:       'new_lf',
    header:   'New LF',
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('new_batch', {
    id:       'new_batch',
    header:   'New Batch',
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('new_mentor', {
    id:       'new_mentor',
    header:   'New Mentor',
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
]

// Label + sort priority: Needs review → Open → In progress → Monitoring → No intervention
function interventionLabel(iv: LearnerRow['intervention']): string {
  if (!iv) return 'No intervention'
  const today = new Date().toISOString().slice(0, 10)
  if (iv.status === 'monitoring' && iv.resurface_date && iv.resurface_date <= today) return 'Needs review'
  if (iv.status === 'open')        return 'Open'
  if (iv.status === 'in_progress') return 'In progress'
  if (iv.status === 'monitoring')  return 'Monitoring'
  return 'No intervention'
}

const INTERVENTION_RANK: Record<string, number> = {
  'Needs review':    0,
  'Open':            1,
  'In progress':     2,
  'Monitoring':      3,
  'No intervention': 4,
}

const interventionColumn = col.accessor(
  (row) => interventionLabel(row.intervention),
  {
    id:            'intervention',
    header:        'Intervention',
    enableHiding:  false,
    enableSorting: true,
    filterFn:      multiSelectFilter,
    sortingFn:     (a, b) =>
      INTERVENTION_RANK[interventionLabel(a.original.intervention)] -
      INTERVENTION_RANK[interventionLabel(b.original.intervention)],
    cell: (info) => <InterventionCell row={info.row.original} />,
  }
)

// ── Popover state ──────────────────────────────────────────────────────────────

type PopoverState = {
  learnerId: string
  metricId:  string
  series:    SeriesPoint[]
  top:       number
  left:      number
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  learners:         LearnerRow[]
  metrics:          MetricCol[]
  subCohortOptions: string[]
}

export default function LearningDashboard({ learners, metrics, subCohortOptions }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const activeSubCohortSet = useMemo(() => {
    const param = searchParams.get('sub_cohort') ?? ''
    return new Set(param ? param.split(',') : [])
  }, [searchParams])

  const [sorting,          setSorting]          = useState<SortingState>([])
  const [columnFilters,    setColumnFilters]    = useState<ColumnFiltersState>([
    { id: 'status', value: ['Ongoing'] },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [columnSizing,     setColumnSizing]     = useState<ColumnSizingState>({})
  const [columnOrder,      setColumnOrder]      = useState<ColumnOrderState>([])
  const [nameSearch,       setNameSearch]       = useState('')
  const [showColMenu,      setShowColMenu]      = useState(false)
  const [popover,          setPopover]          = useState<PopoverState | null>(null)
  const colMenuRef                              = useRef<HTMLDivElement>(null)

  // Hydrate column visibility + sizing + order from localStorage
  useEffect(() => {
    try {
      const v = localStorage.getItem(VISIBILITY_KEY)
      if (v) setColumnVisibility(JSON.parse(v))
      const s = localStorage.getItem(SIZING_KEY)
      if (s) setColumnSizing(JSON.parse(s))
      const o = localStorage.getItem(ORDER_KEY)
      if (o) setColumnOrder(JSON.parse(o))
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

  function toggleSubCohort(value: string) {
    const next = new Set(activeSubCohortSet)
    next.has(value) ? next.delete(value) : next.add(value)
    const params = new URLSearchParams(searchParams.toString())
    if (next.size > 0) params.set('sub_cohort', Array.from(next).join(','))
    else               params.delete('sub_cohort')
    router.push(`/learning?${params.toString()}`)
  }

  function handleNameSearch(val: string) {
    setNameSearch(val)
    table.getColumn('name')?.setFilterValue(val)
  }

  // Dynamic metric columns
  const metricColumns = useMemo(
    () =>
      metrics.map((m) =>
        col.accessor(
          (row) => {
            const c = row.metrics[m.id]
            if (!c) return null
            return c.kind === 'single' ? c.value : c.current
          },
          {
            id:     m.id,
            header: m.name,
            cell:   (info) => (
              <MetricCell
                computed={info.row.original.metrics[m.id]}
                onSparklineClick={(series, top, left) =>
                  setPopover({ learnerId: info.row.original.learner_id, metricId: m.id, series, top, left })
                }
              />
            ),
          }
        )
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metrics]
  )

  const allColumns = useMemo(() => [...fixedColumns, ...metricColumns, interventionColumn], [metricColumns])

  const table = useReactTable({
    data:    learners,
    columns: allColumns,
    state:   { sorting, columnFilters, columnVisibility, columnSizing, columnOrder },
    onSortingChange:       setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((old: VisibilityState) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        try { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    },
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        try { localStorage.setItem(SIZING_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    },
    onColumnOrderChange: (updater) => {
      setColumnOrder((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    },
    columnResizeMode:       'onChange',
    getCoreRowModel:        getCoreRowModel(),
    getSortedRowModel:      getSortedRowModel(),
    getFilteredRowModel:    getFilteredRowModel(),
    getFacetedRowModel:     getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => row.learner_id,
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const rowCountText =
    filteredCount === learners.length
      ? `${learners.length} learner${learners.length !== 1 ? 's' : ''}`
      : `${filteredCount} of ${learners.length} learners`

  // Drag-to-reorder columns
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const current = columnOrder.length ? columnOrder : table.getAllLeafColumns().map((c) => c.id)
    const oldIdx  = current.indexOf(active.id as string)
    const newIdx  = current.indexOf(over.id as string)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(current, oldIdx, newIdx)
    setColumnOrder(next)
    try { localStorage.setItem(ORDER_KEY, JSON.stringify(next)) } catch {}
  }

  if (metrics.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 px-8 py-12 text-center">
        <p className="text-sm text-zinc-500">No metrics defined yet.</p>
        <Link
          href="/learning/settings?tab=metrics"
          className="mt-2 inline-block text-sm text-[#5BAE5B] hover:underline"
        >
          Go to Settings → Metrics to define your first metric →
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Left: sub-cohort pills + search */}
        <div className="flex flex-wrap items-center gap-2">
          {subCohortOptions.map((sc) => (
            <button
              key={sc}
              onClick={() => toggleSubCohort(sc)}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                activeSubCohortSet.has(sc)
                  ? 'border-zinc-800 bg-zinc-800 text-white'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300'
              }`}
            >
              {sc}
            </button>
          ))}

          {/* Search bar */}
          <div className="relative min-w-[180px]">
            <svg
              xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
            >
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => handleNameSearch(e.target.value)}
              placeholder="Search learners…"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-1.5 pl-8 pr-3 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
            />
            {nameSearch && (
              <button
                onClick={() => handleNameSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Right: row count + columns button */}
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
                {metrics.length > 0 && (
                  <>
                    <hr className="my-1.5 border-zinc-100" />
                    <p className="mb-1 px-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">Metrics</p>
                    {metrics.map((m) => {
                      const column = table.getColumn(m.id)
                      if (!column) return null
                      return (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50">
                          <input
                            type="checkbox"
                            checked={column.getIsVisible()}
                            onChange={column.getToggleVisibilityHandler()}
                            className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                          />
                          <span className="text-xs text-zinc-700">{m.name}</span>
                        </label>
                      )
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={table.getFlatHeaders().map((h) => h.id)} strategy={horizontalListSortingStrategy}>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="border-collapse text-sm" style={{ width: '100%' }}>
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                {table.getFlatHeaders().map((header) => (
                  <SortableHeader key={header.id} header={header} />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="group hover:bg-zinc-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {learners.length === 0 && (
                <tr>
                  <td
                    colSpan={fixedColumns.length + metrics.length}
                    className="px-4 py-8 text-center text-sm text-zinc-400"
                  >
                    No learners found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      </SortableContext>
      </DndContext>

      {/* Sparkline popover */}
      {popover && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setPopover(null)} />
          <div
            className="fixed z-30 w-48 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl"
            style={{ top: popover.top + 6, left: popover.left }}
          >
            {popover.series.map((p, i) => (
              <div
                key={p.period}
                className={`flex items-center justify-between px-4 py-1.5 text-xs ${
                  i === popover.series.length - 1
                    ? 'bg-zinc-50 font-medium text-zinc-900'
                    : 'text-zinc-600'
                }`}
              >
                <span className="font-mono">{p.period}</span>
                <span>{p.value !== null ? fmtNum(p.value) : '—'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── MetricCell ─────────────────────────────────────────────────────────────────

function MetricCell({
  computed,
  onSparklineClick,
}: {
  computed: ComputedMetric | undefined
  onSparklineClick: (series: SeriesPoint[], top: number, left: number) => void
}) {
  if (!computed) return <span className="text-zinc-300">—</span>

  if (computed.kind === 'single') {
    if (computed.value === null) return <span className="text-zinc-300">—</span>
    return <span className="tabular-nums text-zinc-800">{fmtNum(computed.value)}</span>
  }

  if (computed.series.length === 0 || computed.current === null) {
    return <span className="text-zinc-300">—</span>
  }

  const { delta } = computed

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          onSparklineClick(computed.series, rect.bottom, rect.left)
        }}
        className="shrink-0 hover:opacity-70"
        title="View series"
      >
        <Sparkline series={computed.series} />
      </button>
      <span className="tabular-nums text-zinc-800">{fmtNum(computed.current)}</span>
      {delta !== null && delta !== 0 && (
        <span className={`text-xs font-medium ${delta > 0 ? 'text-[#639922]' : 'text-[#E24B4A]'}`}>
          {delta > 0 ? '↑' : '↓'}{fmtNum(Math.abs(delta))}
        </span>
      )}
      {delta === 0 && <span className="text-xs text-zinc-400">→</span>}
    </div>
  )
}

// ── Sparkline ──────────────────────────────────────────────────────────────────

function Sparkline({ series }: { series: SeriesPoint[] }) {
  // Show only the last 4 bars in the cell; popover still displays the full series
  const visible = series.slice(-4)
  const values  = visible.map((p) => p.value ?? 0)
  const min     = Math.min(...values)
  const max     = Math.max(...values)
  const range   = max - min
  const H      = 20
  const barW   = 4
  const gap    = 1
  const w      = visible.length * (barW + gap) - gap

  return (
    <svg width={w} height={H}>
      {visible.map((p, i) => {
        const v    = p.value ?? 0
        const pos  = range === 0 ? 0.5 : (v - min) / range
        const barH = Math.max(2, Math.round(pos * (H - 2)) + 2)
        const x    = i * (barW + gap)
        const y    = H - barH
        const fill = pos >= 0.67 ? '#639922' : pos >= 0.33 ? '#EF9F27' : '#E24B4A'
        return <rect key={i} x={x} y={y} width={barW} height={barH} rx={1} fill={fill} />
      })}
    </svg>
  )
}

// ── Sortable header (drag-to-reorder) ──────────────────────────────────────────

function SortableHeader({ header }: { header: Header<LearnerRow, unknown> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width:    header.getSize(),
    opacity:  isDragging ? 0.5 : 1,
  }
  return (
    <th
      ref={setNodeRef}
      style={style}
      className="relative select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
    >
      <div
        {...attributes}
        {...listeners}
        className={header.column.getCanSort() ? 'flex cursor-grab items-center gap-1 active:cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}
        onClick={header.column.getToggleSortingHandler()}
      >
        {flexRender(header.column.columnDef.header, header.getContext())}
        {header.column.getIsSorted() === 'asc'  && <span className="text-zinc-400">↑</span>}
        {header.column.getIsSorted() === 'desc' && <span className="text-zinc-400">↓</span>}
      </div>
      {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
      {header.column.getCanResize() && (
        <div
          onMouseDown={(e) => { e.stopPropagation(); header.getResizeHandler()(e) }}
          onTouchStart={(e) => { e.stopPropagation(); header.getResizeHandler()(e) }}
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-zinc-300"
        />
      )}
    </th>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toFixed(1)
}
