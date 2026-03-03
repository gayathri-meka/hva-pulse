'use client'

import { useState } from 'react'
import ExpandableNote from '@/components/ui/ExpandableNote'
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
  type ColumnSizingState,
  type ColumnFiltersState,
  type Column,
} from '@tanstack/react-table'

export type MatchingStatus =
  | 'applied' | 'shortlisted' | 'on_hold' | 'not_shortlisted' | 'rejected' | 'hired'
  | 'not_applied' | 'not_interested'

export type MatchingRow = {
  learner_id:             string
  name:                   string
  batch:                  string
  lf:                     string
  year_of_graduation:     number | null
  degree:                 string | null
  specialisation:         string | null
  prs_score:              number | null
  proactiveness:          number | null
  articulation:           number | null
  comprehension:          number | null
  tech_score:             number | null
  current_location:       string | null
  is_blacklisted:         boolean
  blacklisted_date:       string | null
  status:                 MatchingStatus
  reasons:                string[]
  not_shortlisted_reason: string | null
  rejection_feedback:     string | null
}

const STATUS_BADGE: Record<MatchingStatus, string> = {
  applied:         'bg-blue-100 text-blue-700',
  shortlisted:     'bg-amber-100 text-amber-700',
  on_hold:         'bg-orange-100 text-orange-700',
  not_shortlisted: 'bg-zinc-100 text-zinc-600',
  rejected:        'bg-red-100 text-red-700',
  hired:           'bg-emerald-100 text-emerald-700',
  not_applied:     'bg-zinc-100 text-zinc-500',
  not_interested:  'bg-zinc-100 text-zinc-400',
}

const STATUS_LABEL: Record<MatchingStatus, string> = {
  applied:         'Applied',
  shortlisted:     'Shortlisted',
  on_hold:         'On Hold',
  not_shortlisted: 'Not Shortlisted',
  rejected:        'Rejected',
  hired:           'Hired',
  not_applied:     'Not Applied',
  not_interested:  'Not Interested',
}

function numCell(val: number | null) {
  return (
    <span className="tabular-nums text-zinc-500">
      {val != null ? val : '—'}
    </span>
  )
}

function FilterSelect({ column }: { column: Column<MatchingRow, unknown> }) {
  const currentValue = (column.getFilterValue() as string) ?? ''

  const options: string[] =
    column.id === 'is_blacklisted'
      ? ['Yes', 'No']
      : Array.from(column.getFacetedUniqueValues().keys())
          .filter((v) => v != null && v !== '')
          .map(String)
          .sort()

  return (
    <select
      className="mt-1 w-full rounded border border-zinc-200 bg-white px-1 py-0.5 text-xs font-normal normal-case tracking-normal text-zinc-600 focus:outline-none"
      value={currentValue}
      onChange={(e) => column.setFilterValue(e.target.value || undefined)}
    >
      <option value="">All</option>
      {options.map((v) => (
        <option key={v} value={v}>{v}</option>
      ))}
    </select>
  )
}

const col = createColumnHelper<MatchingRow>()

const columns = [
  col.accessor('name', {
    header: 'Learner',
    size: 200,
    enableColumnFilter: false,
    cell: (info) => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
  }),
  col.accessor('batch', {
    header: 'Batch',
    size: 150,
    filterFn: 'equals',
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('lf', {
    header: 'LF',
    size: 150,
    filterFn: 'equals',
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('year_of_graduation', {
    header: 'Grad Year',
    size: 110,
    filterFn: (row, colId, filterValue) =>
      !filterValue || String(row.getValue(colId) ?? '') === filterValue,
    cell: (info) => <span className="tabular-nums text-zinc-500">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('degree', {
    header: 'Degree',
    size: 140,
    filterFn: 'equals',
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('specialisation', {
    header: 'Specialisation',
    size: 170,
    filterFn: 'equals',
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('prs_score', {
    header: 'PRS',
    size: 90,
    enableColumnFilter: false,
    cell: (info) => numCell(info.getValue()),
  }),
  col.accessor('proactiveness', {
    header: 'Proactiveness',
    size: 130,
    enableColumnFilter: false,
    cell: (info) => numCell(info.getValue()),
  }),
  col.accessor('articulation', {
    header: 'Articulation',
    size: 120,
    enableColumnFilter: false,
    cell: (info) => numCell(info.getValue()),
  }),
  col.accessor('comprehension', {
    header: 'Comprehension',
    size: 130,
    enableColumnFilter: false,
    cell: (info) => numCell(info.getValue()),
  }),
  col.accessor('tech_score', {
    header: 'Tech Score',
    size: 110,
    enableColumnFilter: false,
    cell: (info) => numCell(info.getValue()),
  }),
  col.accessor('current_location', {
    header: 'Location',
    size: 140,
    filterFn: 'equals',
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('is_blacklisted', {
    header: 'Blacklisted?',
    size: 120,
    enableSorting: false,
    filterFn: (row, _, filterValue) => {
      if (!filterValue) return true
      return filterValue === 'Yes' ? row.original.is_blacklisted : !row.original.is_blacklisted
    },
    cell: (info) => {
      const v    = info.getValue()
      const date = info.row.original.blacklisted_date
      return (
        <span
          title={v && date ? `Blacklisted on ${date}` : undefined}
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            v ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500'
          }`}
        >
          {v ? 'Yes' : 'No'}
        </span>
      )
    },
  }),
  col.accessor('status', {
    header: 'Status',
    size: 160,
    enableColumnFilter: false,
    cell: (info) => {
      const s   = info.getValue()
      const row = info.row.original
      const note =
        s === 'not_interested'  ? (row.reasons.length > 0 ? row.reasons.join(', ') : null)
        : s === 'not_shortlisted' ? row.not_shortlisted_reason
        : s === 'rejected'        ? row.rejection_feedback
        : null
      return (
        <div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[s]}`}>
            {STATUS_LABEL[s]}
          </span>
          {note && <ExpandableNote note={note} />}
        </div>
      )
    },
  }),
]

const SIZING_KEY = 'hva-col-matching'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

export default function MatchingTable({ rows, roleSelected = true }: { rows: MatchingRow[]; roleSelected?: boolean }) {
  const [sorting, setSorting]             = useState<SortingState>([{ id: 'prs_score', desc: true }])
  const [columnSizing, setColumnSizing]   = useState<ColumnSizingState>(loadSizing)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnSizing, columnFilters, columnVisibility: { status: roleSelected } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        localStorage.setItem(SIZING_KEY, JSON.stringify(next))
        return next
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.learner_id,
  })

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table
          className="border-collapse text-sm"
          style={{ width: '100%', minWidth: table.getCenterTotalSize() }}
        >
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
              {table.getFlatHeaders().map((header) => (
                <th
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className="relative select-none px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                >
                  <div
                    className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                    {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                  </div>
                  {header.column.getCanFilter() && (
                    <FilterSelect column={header.column} />
                  )}
                  {header.column.getCanResize() && (
                    <div
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent hover:bg-zinc-300"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-zinc-50">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="px-4 py-3"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-zinc-400">
                  No learners match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
