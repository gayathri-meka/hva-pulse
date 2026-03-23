'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  createColumnHelper,
  type FilterFn,
  type Column,
  type Row,
  type SortingState,
  type ColumnFiltersState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import { exportToCsv } from '@/lib/exportToCsv'
import type { CompanyWithRoles, RoleWithCounts } from '@/types'

const SIZING_KEY = 'hva-col-roles-table'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

type FlatRole = RoleWithCounts & { company_name: string }

const STATUS_BADGE: Record<string, string> = {
  open:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  closed: 'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200',
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Stable filter functions (module scope = stable references) ─────────────────
const multiSelectFilter: FilterFn<FlatRole> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

// Defined outside component so the reference is stable across renders
function globalSearchFn(row: Row<FlatRole>, _colId: string, filterValue: string): boolean {
  const q = filterValue.toLowerCase()
  return (
    row.getValue<string>('company_name').toLowerCase().includes(q) ||
    row.getValue<string>('role_title').toLowerCase().includes(q)
  )
}

// ── FilterDropdown ─────────────────────────────────────────────────────────────
function FilterDropdown({ column }: { column: Column<FlatRole, unknown> }) {
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
    <div ref={ref} className="relative mt-1">
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
              <span className="capitalize">{opt}</span>
            </label>
          ))}
          {options.length === 0 && <p className="px-3 py-1 text-xs text-zinc-400">No values</p>}
        </div>
      )}
    </div>
  )
}

// ── Columns (module scope — stable reference, deterministic UTC date format) ───
const col = createColumnHelper<FlatRole>()

const columns = [
  col.accessor('company_name', {
    header: 'Company',
    size: 180,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="font-medium text-zinc-800">{info.getValue()}</span>,
  }),
  col.accessor('role_title', {
    header: 'Role',
    size: 200,
    cell: (info) => <span className="text-zinc-700">{info.getValue()}</span>,
  }),
  col.accessor('location', {
    header: 'Location',
    size: 140,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-500">{info.getValue() || '—'}</span>,
  }),
  col.accessor('salary_range', {
    header: 'Salary Range',
    size: 140,
    cell: (info) => <span className="text-zinc-500">{info.getValue() || '—'}</span>,
  }),
  col.accessor('status', {
    header: 'Status',
    size: 100,
    filterFn: multiSelectFilter,
    cell: (info) => (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[info.getValue()] ?? ''}`}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor('created_at', {
    header: 'Date Added',
    size: 120,
    // Use UTC date parts so server-render and browser hydration produce identical output
    cell: (info) => {
      const d = new Date(info.getValue())
      return (
        <span className="text-zinc-500">
          {d.getUTCDate()} {MONTHS[d.getUTCMonth()]} {d.getUTCFullYear()}
        </span>
      )
    },
    sortingFn: 'datetime',
  }),
]

// ── Component ──────────────────────────────────────────────────────────────────
export default function RolesTable({ companies }: { companies: CompanyWithRoles[] }) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const weekParam    = searchParams.get('week')

  const [sorting, setSorting]             = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing]   = useState<ColumnSizingState>(loadSizing)
  const [globalFilter, setGlobalFilter]   = useState('')

  useEffect(() => {
    localStorage.setItem(SIZING_KEY, JSON.stringify(columnSizing))
  }, [columnSizing])

  // Memoize derived data so TanStack Table only reprocesses when companies or
  // weekParam actually change — not on every filter/sort state update.
  const allRoles = useMemo<FlatRole[]>(
    () => companies.flatMap((c) => c.roles.map((r) => ({ ...r, company_name: c.company_name }))),
    [companies],
  )

  const weekFilteredRoles = useMemo<FlatRole[]>(() => {
    if (!weekParam) return allRoles
    // Parse as explicit UTC so it matches the UTC isoDate generated on the server
    const weekStart = new Date(weekParam + 'T00:00:00Z')
    const weekEnd   = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    return allRoles.filter((r) => {
      const d = new Date(r.created_at)
      return d >= weekStart && d < weekEnd
    })
  }, [allRoles, weekParam])

  const weekLabel = useMemo(() => {
    if (!weekParam) return null
    const d = new Date(weekParam + 'T00:00:00Z')
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  }, [weekParam])

  function clearWeek() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('week')
    router.push(`?${params.toString()}`)
  }

  const table = useReactTable({
    data: weekFilteredRoles,
    columns,
    filterFns: { multiSelectFilter },
    state: { sorting, columnFilters, columnSizing, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearchFn,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const rows            = table.getRowModel().rows
  const hasActiveFilter = columnFilters.length > 0 || globalFilter.length > 0

  function clearAllFilters() {
    setColumnFilters([])
    setGlobalFilter('')
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {weekLabel && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            Week of {weekLabel}
            <button onClick={clearWeek} className="ml-0.5 text-zinc-400 hover:text-white" title="Clear">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </span>
        )}

        <div className="relative min-w-[180px] max-w-xs flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
          >
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search company or role…"
            className="w-full rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          />
          {globalFilter && (
            <button
              onClick={() => setGlobalFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>

        <span className="text-sm text-zinc-400">{rows.length} role{rows.length !== 1 ? 's' : ''}</span>

        {hasActiveFilter && (
          <button onClick={clearAllFilters} className="text-xs font-medium text-blue-500 hover:text-blue-700">
            Clear filters
          </button>
        )}

        <button
          onClick={() => exportToCsv(table, `roles_${new Date().toISOString().slice(0, 10)}.csv`)}
          disabled={rows.length === 0}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          title="Download CSV"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
          CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed', width: table.getTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-zinc-100">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize(), position: 'relative' }}
                    className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    {header.isPlaceholder ? null : (
                      <>
                        <div
                          className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-zinc-600' : ''}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                          {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                        </div>
                        {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
                      </>
                    )}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-zinc-200 opacity-0 hover:opacity-100"
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-zinc-400">
                  No roles found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-zinc-50 hover:bg-zinc-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ width: cell.column.getSize() }} className="overflow-hidden text-ellipsis whitespace-nowrap px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
