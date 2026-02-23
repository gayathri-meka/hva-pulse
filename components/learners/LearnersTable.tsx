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

const SIZING_KEY = 'hva-col-learners'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

const STATUS_BADGE: Record<string, string> = {
  Ongoing:        'bg-emerald-100 text-emerald-700',
  Dropout:        'bg-red-100 text-red-700',
  Discontinued:   'bg-zinc-200 text-zinc-600',
  'Placed - Self': 'bg-blue-100 text-blue-700',
  'Placed - HVA': 'bg-violet-100 text-violet-700',
}

type LearnerRow = {
  learner_id: string
  name:       string
  email:      string
  batch_name: string
  status:     string
  lf_name:    string
  track:      string
  join_date:  string | null
}

const col = createColumnHelper<LearnerRow>()

const columns = [
  col.accessor('learner_id', {
    header: 'ID',
    size: 90,
    cell: (info) => <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>,
  }),
  col.accessor('name', {
    header: 'Name',
    size: 200,
    cell: (info) => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
  }),
  col.accessor('email', {
    header: 'Email',
    size: 240,
    cell: (info) => <span className="text-zinc-400">{info.getValue()}</span>,
  }),
  col.accessor('batch_name', {
    header: 'Batch',
    size: 140,
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('status', {
    header: 'Status',
    size: 130,
    cell: (info) => (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          STATUS_BADGE[info.getValue()] ?? 'bg-zinc-100 text-zinc-600'
        }`}
      >
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor('lf_name', {
    header: 'LF',
    size: 160,
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('track', {
    header: 'Track',
    size: 140,
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('join_date', {
    header: 'Joined',
    size: 110,
    cell: (info) => <span className="text-zinc-400">{info.getValue() ?? '—'}</span>,
  }),
]

export default function LearnersTable({ learners }: { learners: LearnerRow[] }) {
  const [sorting, setSorting]           = useState<SortingState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadSizing)

  const table = useReactTable({
    data: learners,
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
            {learners.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-zinc-400">
                  No learners found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
