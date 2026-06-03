'use client'

import { useMemo, useState } from 'react'
import { exportToCsv } from '@/lib/exportToCsv'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnSizingState,
} from '@tanstack/react-table'
import type { Prospect } from './page'

const SIZING_KEY = 'hva-col-prospects'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

const col = createColumnHelper<Prospect>()

type FormFilter = 'all' | 'submitted' | 'pending'

export default function ProspectsTable({ prospects }: { prospects: Prospect[] }) {
  const [sorting, setSorting]           = useState<SortingState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadSizing)
  const [formFilter, setFormFilter]     = useState<FormFilter>('all')

  const filteredProspects = useMemo(() => {
    if (formFilter === 'submitted') return prospects.filter((p) => p.interest_form_submitted_at)
    if (formFilter === 'pending')   return prospects.filter((p) => !p.interest_form_submitted_at)
    return prospects
  }, [prospects, formFilter])

  const submittedCount = useMemo(
    () => prospects.filter((p) => p.interest_form_submitted_at).length,
    [prospects],
  )
  const pendingCount = prospects.length - submittedCount

  const columns = [
    col.accessor('created_at', {
      header: 'Signed up',
      size: 140,
      cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
    }),
    col.accessor('name', {
      header: 'Name',
      size: 200,
      cell: (info) => <span className="font-medium text-zinc-900">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('email', {
      header: 'Email',
      size: 260,
      cell: (info) => (
        <a href={`mailto:${info.getValue()}`} className="text-zinc-600 hover:text-zinc-900 hover:underline">
          {info.getValue()}
        </a>
      ),
    }),
    col.accessor('phone', {
      header: 'Phone',
      size: 130,
      cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('college', {
      header: 'College',
      size: 240,
      cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('education_status', {
      header: 'Education status',
      size: 220,
      cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('interest_form_submitted_at', {
      header: 'Interest form',
      size: 160,
      cell: (info) => {
        const submittedAt = info.getValue()
        if (submittedAt) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Submitted
            </span>
          )
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
            Pending
          </span>
        )
      },
    }),
    col.accessor((row) => row.interest_form_submitted_at, {
      id: 'form_fill_date',
      header: 'Form fill date',
      size: 140,
      sortingFn: (a, b) => {
        const av = a.original.interest_form_submitted_at
        const bv = b.original.interest_form_submitted_at
        if (!av && !bv) return 0
        if (!av) return 1
        if (!bv) return -1
        return new Date(av).getTime() - new Date(bv).getTime()
      },
      cell: (info) => {
        const v = info.getValue() as string | null
        return v
          ? <span className="text-zinc-500">{formatDate(v)}</span>
          : <span className="text-zinc-300">—</span>
      },
    }),
    col.accessor('last_seen_at', {
      header: 'Last seen',
      size: 140,
      cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
    }),
  ]

  const table = useReactTable({
    data: filteredProspects,
    columns,
    state: { sorting, columnSizing },
    onSortingChange: setSorting,
    onColumnSizingChange: (updater) => {
      setColumnSizing((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        localStorage.setItem(SIZING_KEY, JSON.stringify(next))
        return next
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
  })

  if (prospects.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No prospects yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          <FilterPill
            active={formFilter === 'all'}
            onClick={() => setFormFilter('all')}
            label="All"
            count={prospects.length}
          />
          <FilterPill
            active={formFilter === 'submitted'}
            onClick={() => setFormFilter('submitted')}
            label="Submitted form"
            count={submittedCount}
          />
          <FilterPill
            active={formFilter === 'pending'}
            onClick={() => setFormFilter('pending')}
            label="Pending"
            count={pendingCount}
          />
        </div>
        <button
          onClick={() => exportToCsv(table, `prospects_${new Date().toISOString().slice(0, 10)}.csv`)}
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
                {table.getFlatHeaders().map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="sticky top-0 z-10 bg-zinc-50 relative select-none px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    <div
                      className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                      {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                    </div>
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
                      className="px-6 py-3.5"
                    >
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

function FilterPill({
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
