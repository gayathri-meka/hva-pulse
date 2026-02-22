'use client'

import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnSizingState,
} from '@tanstack/react-table'

export type MatchingStatus =
  | 'applied' | 'shortlisted' | 'rejected' | 'hired'
  | 'not_applied' | 'not_interested'

export type MatchingRow = {
  learner_id: string
  name:       string
  batch:      string
  lf:         string
  prs_score:  number | null
  status:     MatchingStatus
}

const STATUS_BADGE: Record<MatchingStatus, string> = {
  applied:        'bg-blue-100 text-blue-700',
  shortlisted:    'bg-amber-100 text-amber-700',
  rejected:       'bg-red-100 text-red-700',
  hired:          'bg-emerald-100 text-emerald-700',
  not_applied:    'bg-zinc-100 text-zinc-500',
  not_interested: 'bg-zinc-100 text-zinc-400',
}

const STATUS_LABEL: Record<MatchingStatus, string> = {
  applied:        'Applied',
  shortlisted:    'Shortlisted',
  rejected:       'Rejected',
  hired:          'Hired',
  not_applied:    'Not Applied',
  not_interested: 'Not Interested',
}

const col = createColumnHelper<MatchingRow>()

const columns = [
  col.accessor('name', {
    header: 'Learner',
    size: 200,
    cell: (info) => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
  }),
  col.accessor('batch', {
    header: 'Batch',
    size: 150,
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('lf', {
    header: 'LF',
    size: 160,
    cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
  }),
  col.accessor('prs_score', {
    header: 'PRS Score',
    size: 110,
    cell: (info) => (
      <span className="tabular-nums text-zinc-400">
        {info.getValue() != null ? info.getValue() : '—'}
      </span>
    ),
  }),
  col.accessor('status', {
    header: 'Status',
    size: 140,
    cell: (info) => {
      const s = info.getValue()
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[s]}`}>
          {STATUS_LABEL[s]}
        </span>
      )
    },
  }),
]

const SIZING_KEY = 'hva-col-matching'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

export default function MatchingTable({ rows }: { rows: MatchingRow[] }) {
  const [sorting, setSorting]           = useState<SortingState>([{ id: 'prs_score', desc: true }])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadSizing)

  const table = useReactTable({
    data: rows,
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
                  className="relative select-none px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
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
            {rows.length === 0 && (
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
