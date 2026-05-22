'use client'

import { useState } from 'react'
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

const col = createColumnHelper<LearnerApplication>()

export default function LearnerApplicationsTable({ applications }: { applications: LearnerApplication[] }) {
  const [sorting, setSorting]           = useState<SortingState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadSizing)

  const columns = [
    col.accessor('created_at', {
      header: 'Submitted',
      size: 140,
      cell: (info) => (
        <span className="text-zinc-500">
          {new Date(info.getValue()).toLocaleDateString('en-GB', {
            day:   '2-digit',
            month: 'short',
            year:  'numeric',
          })}
        </span>
      ),
    }),
    col.accessor('name', {
      header: 'Name',
      size: 200,
      cell: (info) => <span className="font-medium text-zinc-900">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('email', {
      header: 'Email',
      size: 240,
      cell: (info) => {
        const v = info.getValue()
        return v
          ? <a href={`mailto:${v}`} className="text-zinc-600 hover:text-zinc-900 hover:underline">{v}</a>
          : <span className="text-zinc-400">—</span>
      },
    }),
    col.accessor('phone', {
      header: 'Phone',
      size: 140,
      cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('college_name', {
      header: 'College',
      size: 240,
      cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('educational_status', {
      header: 'Educational Status',
      size: 180,
      cell: (info) => (
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
          {formatStatus(info.getValue())}
        </span>
      ),
    }),
  ]

  const table = useReactTable({
    data: applications,
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

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No applications yet.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => exportToCsv(table, `learner_admissions_${new Date().toISOString().slice(0, 10)}.csv`)}
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
