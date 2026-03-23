'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
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

const col = createColumnHelper<FlatRole>()

const columns = [
  col.accessor('company_name', {
    header: 'Company',
    size: 180,
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
    cell: (info) => (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[info.getValue()] ?? ''}`}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor('created_at', {
    header: 'Date Added',
    size: 120,
    cell: (info) => (
      <span className="text-zinc-500">
        {new Date(info.getValue()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
      </span>
    ),
    sortingFn: 'datetime',
  }),
]

export default function RolesTable({ companies }: { companies: CompanyWithRoles[] }) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const weekParam    = searchParams.get('week')

  const [sorting, setSorting]           = useState<SortingState>([{ id: 'created_at', desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing]  = useState<ColumnSizingState>(loadSizing)

  // Persist column sizing
  useEffect(() => {
    localStorage.setItem(SIZING_KEY, JSON.stringify(columnSizing))
  }, [columnSizing])

  // Flat-map roles with company name
  const allRoles: FlatRole[] = companies.flatMap((c) =>
    c.roles.map((r) => ({ ...r, company_name: c.company_name })),
  )

  // Filter to the selected week if present
  const filteredRoles = weekParam
    ? allRoles.filter((r) => {
        const roleDate = new Date(r.created_at)
        const weekStart = new Date(weekParam + 'T00:00:00')
        const weekEnd   = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        return roleDate >= weekStart && roleDate < weekEnd
      })
    : allRoles

  const weekLabel = weekParam
    ? new Date(weekParam + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  function clearWeek() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('week')
    router.push(`?${params.toString()}`)
  }

  const table = useReactTable({
    data: filteredRoles,
    columns,
    state: { sorting, columnFilters, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const rows = table.getRowModel().rows

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-3 flex items-center gap-3">
        {weekLabel && (
          <span className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            Week of {weekLabel}
            <button onClick={clearWeek} className="ml-0.5 text-zinc-400 hover:text-white" title="Clear filter">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </span>
        )}
        <span className="text-sm text-zinc-400">{rows.length} role{rows.length !== 1 ? 's' : ''}</span>
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
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer select-none hover:text-zinc-600' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                        {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                      </div>
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
