'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
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
} from '@tanstack/react-table'
import { startIntervention } from '@/app/(protected)/learning/actions'

// ── Types ──────────────────────────────────────────────────────────────────────

export type InterventionRow = {
  id:                  string
  learner_id:          string
  learner_name:        string
  status:              'open' | 'in_progress' | 'follow_up'
  root_cause_filled:   boolean
  total_action_items:  number
  done_action_items:   number
  decision_date:       string | null
}

export type LearnerOption = {
  learner_id: string
  name:       string
}

interface Props {
  rows:     InterventionRow[]
  learners: LearnerOption[]
}

// ── Filter ─────────────────────────────────────────────────────────────────────

const multiSelectFilter: FilterFn<InterventionRow> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

function FilterDropdown({ column }: { column: Column<InterventionRow, unknown> }) {
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

// ── New Intervention Modal ─────────────────────────────────────────────────────

function NewInterventionModal({ learners, onClose }: { learners: LearnerOption[]; onClose: () => void }) {
  const router                    = useRouter()
  const [query, setQuery]         = useState('')
  const [selected, setSelected]   = useState<LearnerOption | null>(null)
  const [dropOpen, setDropOpen]   = useState(false)
  const [isPending, startTrans]   = useTransition()
  const [error, setError]         = useState('')
  const inputRef                  = useRef<HTMLInputElement>(null)
  const dropRef                   = useRef<HTMLDivElement>(null)

  const filtered = query.trim()
    ? learners.filter((l) => l.name.toLowerCase().includes(query.toLowerCase()))
    : learners

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
  }

  function handleCreate() {
    if (!selected) return
    setError('')
    startTrans(async () => {
      try {
        await startIntervention(selected.learner_id)
        router.refresh()
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-900">New intervention</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-500">Search for a learner to start an intervention.</p>

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
            {isPending ? 'Creating…' : 'Create intervention'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusLabel(row: InterventionRow): string {
  const today = new Date().toISOString().slice(0, 10)
  if (row.status === 'follow_up' && row.decision_date && row.decision_date <= today) return 'Needs review'
  if (row.status === 'open')        return 'Open'
  if (row.status === 'in_progress') return 'In progress'
  if (row.status === 'follow_up')   return 'Follow-up'
  return 'Open'
}

const STATUS_RANK: Record<string, number> = {
  'Needs review': 0, Open: 1, 'In progress': 2, Monitoring: 3,
}

function statusBadge(label: string): string {
  if (label === 'Needs review') return 'bg-amber-50 text-amber-700 border-2 border-amber-400'
  if (label === 'Open')         return 'bg-red-50 text-red-600 border border-red-200'
  return 'bg-amber-50 text-amber-600 border border-amber-200'
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Columns ────────────────────────────────────────────────────────────────────

const col = createColumnHelper<InterventionRow>()

const columns = [
  col.accessor('learner_name', {
    id:       'learner_name',
    header:   'Learner',
    cell:     (info) => (
      <Link
        href={`/learning?filter=interventions&view=learner&learner=${info.row.original.learner_id}`}
        className="font-medium text-zinc-900 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
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
  col.accessor((row) => (row.root_cause_filled ? 'Filled' : 'Not filled'), {
    id:       'root_cause',
    header:   'Root cause',
    filterFn: multiSelectFilter,
    cell: (info) => {
      const filled = info.row.original.root_cause_filled
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          filled
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-zinc-50 text-zinc-500 border border-zinc-200'
        }`}>
          {filled ? 'Filled' : 'Not filled'}
        </span>
      )
    },
  }),
  col.accessor((row) => row.total_action_items, {
    id:     'action_plan',
    header: 'Action plan',
    cell: (info) => {
      const r = info.row.original
      if (r.total_action_items === 0) {
        return <span className="text-xs text-zinc-400">No items</span>
      }
      return (
        <span className="text-sm tabular-nums text-zinc-700">
          {r.done_action_items}/{r.total_action_items}{' '}
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

// ── Component ──────────────────────────────────────────────────────────────────

export default function InterventionsTable({ rows, learners }: Props) {
  const [sorting,       setSorting]       = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [showModal,     setShowModal]     = useState(false)

  const table = useReactTable({
    data:    rows,
    columns,
    state:   { sorting, columnFilters },
    onSortingChange:       setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel:        getCoreRowModel(),
    getSortedRowModel:      getSortedRowModel(),
    getFilteredRowModel:    getFilteredRowModel(),
    getFacetedRowModel:     getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => row.id,
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const rowCountText  =
    filteredCount === rows.length
      ? `${rows.length} intervention${rows.length !== 1 ? 's' : ''}`
      : `${filteredCount} of ${rows.length} interventions`

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-zinc-500">{rowCountText}</span>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          + New intervention
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 px-8 py-12 text-center">
          <p className="text-sm text-zinc-400">No active interventions yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                  {table.getFlatHeaders().map((header) => (
                    <th
                      key={header.id}
                      className="select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                    >
                      <div
                        className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  && <span className="text-zinc-400">↑</span>}
                        {header.column.getIsSorted() === 'desc' && <span className="text-zinc-400">↓</span>}
                      </div>
                      {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
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
        <NewInterventionModal learners={learners} onClose={() => setShowModal(false)} />
      )}
    </div>
  )
}
