'use client'

import { useState, useEffect, useRef } from 'react'
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

// ── Types ──────────────────────────────────────────────────────────────────────

export type InterventionRow = {
  id:                  string
  learner_id:          string
  learner_name:        string
  status:              'open' | 'in_progress' | 'monitoring'
  root_cause_filled:   boolean
  total_action_items:  number
  done_action_items:   number
  resurface_date:      string | null
}

interface Props {
  rows: InterventionRow[]
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusLabel(row: InterventionRow): string {
  const today = new Date().toISOString().slice(0, 10)
  if (row.status === 'monitoring' && row.resurface_date && row.resurface_date <= today) return 'Needs review'
  if (row.status === 'open')        return 'Open'
  if (row.status === 'in_progress') return 'In progress'
  if (row.status === 'monitoring')  return 'Monitoring'
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
  col.accessor('resurface_date', {
    id:     'resurface_date',
    header: 'Resurface date',
    sortingFn: (a, b) => {
      const av = a.original.resurface_date ?? ''
      const bv = b.original.resurface_date ?? ''
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

export default function InterventionsTable({ rows }: Props) {
  const [sorting,       setSorting]       = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 px-8 py-12 text-center">
        <p className="text-sm text-zinc-400">No active interventions yet.</p>
      </div>
    )
  }

  const filteredCount = table.getFilteredRowModel().rows.length
  const rowCountText  =
    filteredCount === rows.length
      ? `${rows.length} intervention${rows.length !== 1 ? 's' : ''}`
      : `${filteredCount} of ${rows.length} interventions`

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <span className="text-sm text-zinc-500">{rowCountText}</span>
      </div>

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
    </div>
  )
}
