'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
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

export type NotInterestedRow = {
  user_id:      string
  role_id:      string
  learner_name: string
  batch:        string
  lf:           string
  company_name: string
  role_title:   string
  reasons:      string[]
}

const multiSelectFilter: FilterFn<NotInterestedRow> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

// Reasons is an array — match if any reason is in the selected filter values
const reasonsFilter: FilterFn<NotInterestedRow> = (row, _colId, filterValues: string[]) =>
  !filterValues?.length || row.original.reasons.some((r) => filterValues.includes(r))
reasonsFilter.autoRemove = (val: string[]) => !val?.length

function FilterDropdown({
  column,
  optionsOverride,
}: {
  column: Column<NotInterestedRow, unknown>
  optionsOverride?: string[]
}) {
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)
  const selected            = (column.getFilterValue() as string[]) ?? []

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const options = optionsOverride ?? Array.from(column.getFacetedUniqueValues().keys())
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

const col = createColumnHelper<NotInterestedRow>()

const columns = [
  col.accessor('learner_name', {
    header: 'Learner',
    size: 180,
    enableColumnFilter: false,
    cell: (info) => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
  }),
  col.accessor('batch', {
    header: 'Batch',
    size: 140,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('lf', {
    header: 'LF',
    size: 140,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('company_name', {
    header: 'Company',
    size: 160,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('role_title', {
    header: 'Role',
    size: 200,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('reasons', {
    header: 'Reasons',
    size: 280,
    filterFn: reasonsFilter,
    sortingFn: (a, b) =>
      a.original.reasons.join(', ').localeCompare(b.original.reasons.join(', ')),
    cell: (info) => {
      const reasons = info.getValue()
      if (!reasons.length) return <span className="text-zinc-400">—</span>
      return (
        <div className="flex flex-wrap gap-1">
          {reasons.map((r) => (
            <span key={r} className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
              {r}
            </span>
          ))}
        </div>
      )
    },
  }),
]

export default function NotInterestedTable({ rows }: { rows: NotInterestedRow[] }) {
  const [sorting, setSorting]             = useState<SortingState>([{ id: 'learner_name', desc: false }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const allReasons = useMemo(
    () => Array.from(new Set(rows.flatMap((r) => r.reasons))).sort(),
    [rows],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row) => `${row.user_id}:${row.role_id}`,
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
                  className="select-none px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400"
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
                    <FilterDropdown
                      column={header.column}
                      optionsOverride={header.column.id === 'reasons' ? allReasons : undefined}
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
                  <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-zinc-400">
                  No not-interested records match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
