'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
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
  type FilterFn,
} from '@tanstack/react-table'
import type { JobOpportunityWithPersona, JobPersona } from '@/types'
import OpportunityDrawer from './OpportunityDrawer'

// ── Status display ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  discovered: 'bg-zinc-100 text-zinc-600',
  reviewed:   'bg-blue-100 text-blue-700',
  approved:   'bg-emerald-100 text-emerald-700',
  rejected:   'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  discovered: 'Discovered',
  reviewed:   'Reviewed',
  approved:   'Approved',
  rejected:   'Rejected',
}

// ── Multi-select filterFn (same pattern as MatchingTable) ─────────────────────
const multiSelectFilter: FilterFn<JobOpportunityWithPersona> = (row, colId, vals: string[]) =>
  !vals?.length || vals.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (v: string[]) => !v?.length

// ── FilterDropdown ────────────────────────────────────────────────────────────
function FilterDropdown({ column }: { column: Column<JobOpportunityWithPersona, unknown> }) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const selected        = (column.getFilterValue() as string[]) ?? []

  useEffect(() => {
    if (!open) return
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
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
              className="w-full px-3 py-1 text-left text-xs text-blue-500 hover:bg-zinc-50 border-b border-zinc-100"
            >
              Clear filter
            </button>
          )}
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 capitalize">
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

// ── Column sizing ─────────────────────────────────────────────────────────────
const SIZING_KEY = 'hva-col-opportunities'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

// ── Component ─────────────────────────────────────────────────────────────────
type Props = {
  opportunities: JobOpportunityWithPersona[]
  personas:      Pick<JobPersona, 'id' | 'name'>[]
}

export default function OpportunitiesClient({ opportunities }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const selectedId   = searchParams.get('id') ?? undefined

  const [search, setSearch]               = useState('')
  const [sorting, setSorting]             = useState<SortingState>([{ id: 'date_posted', desc: true }])
  const [columnSizing, setColumnSizing]   = useState<ColumnSizingState>(loadSizing)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const selectedOpportunity = selectedId
    ? opportunities.find((o) => o.id === selectedId) ?? null
    : null

  function openDrawer(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('id', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  // Global text search (title + company) applied before TanStack sees the data
  const filtered = useMemo(() => {
    if (!search.trim()) return opportunities
    const s = search.trim().toLowerCase()
    return opportunities.filter(
      (o) => o.job_title.toLowerCase().includes(s) || o.company_name.toLowerCase().includes(s)
    )
  }, [opportunities, search])

  const col = createColumnHelper<JobOpportunityWithPersona>()

  const columns = useMemo(() => [
    col.accessor('job_title', {
      header: 'Job Title',
      size:   240,
      enableColumnFilter: false,
      cell: (info) => (
        <span className="block max-w-[220px] truncate font-medium text-zinc-900" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    col.accessor('company_name', {
      header: 'Company',
      size:   180,
      enableColumnFilter: false,
      cell: (info) => <span className="block max-w-[160px] truncate text-zinc-600">{info.getValue()}</span>,
    }),
    col.accessor('location', {
      header: 'Location',
      size:   160,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-500">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('source_platform', {
      header: 'Source',
      size:   120,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="capitalize text-zinc-500">{info.getValue()}</span>,
    }),
    col.accessor('date_posted', {
      header: 'Posted',
      size:   100,
      enableColumnFilter: false,
      cell: (info) => {
        const v = info.getValue()
        return <span className="text-zinc-500">{v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}</span>
      },
    }),
    col.accessor('persona_name', {
      header: 'Persona',
      size:   160,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="block max-w-[140px] truncate text-zinc-500">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      size:   120,
      filterFn: multiSelectFilter,
      cell: (info) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[info.getValue()] ?? ''}`}>
          {STATUS_LABEL[info.getValue()] ?? info.getValue()}
        </span>
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnSizing, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        localStorage.setItem(SIZING_KEY, JSON.stringify(next))
        return next
      })
    },
    getCoreRowModel:        getCoreRowModel(),
    getSortedRowModel:      getSortedRowModel(),
    getFilteredRowModel:    getFilteredRowModel(),
    getFacetedRowModel:     getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    columnResizeMode:       'onChange',
    getRowId:               (row) => row.id,
  })

  const rowCount = table.getRowModel().rows.length

  return (
    <div>
      {/* Search + result count */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
          >
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or company…"
            className="w-64 rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>
        <span className="ml-auto text-xs text-zinc-400">
          {rowCount} result{rowCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
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
                    {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
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
                <tr
                  key={row.id}
                  onClick={() => openDrawer(row.original.id)}
                  className={`cursor-pointer transition-colors hover:bg-zinc-50 ${
                    selectedId === row.original.id ? 'bg-zinc-50' : ''
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ width: cell.column.getSize() }} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-16 text-center text-sm text-zinc-400">
                    {opportunities.length === 0
                      ? 'Run a scrape from the Job Personas tab to discover opportunities'
                      : 'No opportunities match the current filters'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedOpportunity && <OpportunityDrawer opportunity={selectedOpportunity} />}
    </div>
  )
}
