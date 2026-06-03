'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { exportToCsv } from '@/lib/exportToCsv'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  createColumnHelper,
  type Column,
  type ColumnFiltersState,
  type ColumnSizingState,
  type FilterFn,
  type SortingState,
} from '@tanstack/react-table'
import type { LearnerApplication } from './page'

const SIZING_KEY = 'hva-col-learner-admissions'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

function formatStatus(value: string | null): string {
  if (!value) return '—'
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

const multiSelectFilter: FilterFn<LearnerApplication> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

const col = createColumnHelper<LearnerApplication>()

type SignedFilter = 'all' | 'yes' | 'no'

export default function LearnerApplicationsTable({ applications }: { applications: LearnerApplication[] }) {
  const [sorting, setSorting]               = useState<SortingState>([])
  const [columnSizing, setColumnSizing]     = useState<ColumnSizingState>(loadSizing)
  const [columnFilters, setColumnFilters]   = useState<ColumnFiltersState>([])
  const [signedFilter, setSignedFilter]     = useState<SignedFilter>('all')

  const filtered = useMemo(() => {
    if (signedFilter === 'yes') return applications.filter((a) => a.signed_into_pulse)
    if (signedFilter === 'no')  return applications.filter((a) => !a.signed_into_pulse)
    return applications
  }, [applications, signedFilter])

  const yesCount = useMemo(
    () => applications.filter((a) => a.signed_into_pulse).length,
    [applications],
  )
  const noCount = applications.length - yesCount

  const columns = useMemo(
    () => [
      col.accessor('created_at', {
        header: 'Submitted',
        size: 130,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
      }),
      col.accessor('name', {
        header: 'Name',
        size: 180,
        enableColumnFilter: false,
        cell: (info) => <span className="font-medium text-zinc-900">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('email', {
        header: 'Email',
        size: 240,
        enableColumnFilter: false,
        cell: (info) => {
          const v = info.getValue()
          return v
            ? <a href={`mailto:${v}`} className="text-zinc-600 hover:text-zinc-900 hover:underline">{v}</a>
            : <span className="text-zinc-400">—</span>
        },
      }),
      col.accessor('phone', {
        header: 'Phone',
        size: 130,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('college_name', {
        header: 'College',
        size: 240,
        filterFn: multiSelectFilter,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('educational_status', {
        header: 'Educational Status',
        size: 180,
        filterFn: multiSelectFilter,
        cell: (info) => (
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
            {formatStatus(info.getValue())}
          </span>
        ),
      }),
      col.accessor('signed_into_pulse', {
        header: 'Signed into Pulse?',
        size: 150,
        enableColumnFilter: false,
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Yes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              No
            </span>
          ),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: {
      sorting,
      columnSizing,
      columnFilters,
      columnPinning: { left: ['created_at', 'name'] },
    },
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
    getRowId: (row) => row.id,
  })

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No applications yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          <SignedPill
            active={signedFilter === 'all'}
            onClick={() => setSignedFilter('all')}
            label="All"
            count={applications.length}
          />
          <SignedPill
            active={signedFilter === 'yes'}
            onClick={() => setSignedFilter('yes')}
            label="Signed into Pulse"
            count={yesCount}
          />
          <SignedPill
            active={signedFilter === 'no'}
            onClick={() => setSignedFilter('no')}
            label="Not signed in"
            count={noCount}
          />
        </div>
        <button
          onClick={() => exportToCsv(table, `website_hits_${new Date().toISOString().slice(0, 10)}.csv`)}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
          title="Download CSV"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table
            className="border-collapse text-sm"
            style={{ width: '100%', minWidth: table.getCenterTotalSize() }}
          >
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                {table.getFlatHeaders().map((header) => {
                  const pinned       = header.column.getIsPinned() === 'left'
                  const isLastPinned = pinned && header.column.getIsLastColumn('left')
                  const left         = pinned ? header.column.getStart('left') : undefined
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), left }}
                      className={`sticky top-0 select-none px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${
                        pinned ? 'z-20 bg-zinc-50' : 'z-10 bg-zinc-50'
                      } ${isLastPinned ? 'border-r border-zinc-200' : ''}`}
                    >
                      <div className="flex flex-col gap-1">
                        <div
                          className={`relative flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                          {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                          {header.column.getCanResize() && (
                            <div
                              onMouseDown={(e) => { e.stopPropagation(); header.getResizeHandler()(e) }}
                              onTouchStart={(e) => { e.stopPropagation(); header.getResizeHandler()(e) }}
                              className="absolute right-0 top-1/2 h-4 w-1.5 -translate-y-1/2 cursor-col-resize bg-transparent hover:bg-zinc-300"
                            />
                          )}
                        </div>
                        {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="group hover:bg-zinc-50">
                  {row.getVisibleCells().map((cell) => {
                    const pinned       = cell.column.getIsPinned() === 'left'
                    const isLastPinned = pinned && cell.column.getIsLastColumn('left')
                    const left         = pinned ? cell.column.getStart('left') : undefined
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize(), left }}
                        className={`px-6 py-3.5 ${
                          pinned ? 'sticky z-10 bg-white group-hover:bg-zinc-50' : ''
                        } ${isLastPinned ? 'border-r border-zinc-200' : ''}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SignedPill({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
        active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-[10px] ${
        active ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-200/70 text-zinc-500'
      }`}>
        {count}
      </span>
    </button>
  )
}

function FilterDropdown({ column }: { column: Column<LearnerApplication, unknown> }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const selected        = (column.getFilterValue() as string[]) ?? []

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const options = useMemo(
    () =>
      Array.from(column.getFacetedUniqueValues().keys())
        .filter((v) => v != null && v !== '')
        .map(String)
        .sort(),
    [column],
  )

  function toggle(val: string) {
    const next = selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    column.setFilterValue(next.length ? next : undefined)
  }

  const label =
    selected.length === 0 ? 'All'
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded border bg-white px-2 py-0.5 text-left text-[11px] font-normal normal-case tracking-normal focus:outline-none ${
          selected.length ? 'border-[#5BAE5B] text-zinc-900' : 'border-zinc-200 text-zinc-500'
        }`}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3 w-3 shrink-0 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-0.5 max-h-52 min-w-[180px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg">
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
