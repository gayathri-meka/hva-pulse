'use client'

import { Fragment, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import CaseHistory, { type ClosedCase } from './CaseHistory'

// Compact table of closed cases. Each row collapses into a summary; clicking
// the row toggles an expanded detail panel underneath that reuses the same
// rich card layout used elsewhere (CaseHistory).

interface Props {
  rows: ClosedCase[]
}

const OUTCOME_BADGE: Record<string, string> = {
  resolved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  dropped:  'bg-zinc-50 text-zinc-600 border border-zinc-200',
  other:    'bg-amber-50 text-amber-700 border border-amber-200',
}

const SEVERITY_BADGE: Record<string, string> = {
  Low:    'bg-zinc-100 text-zinc-600',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const col = createColumnHelper<ClosedCase>()

const columns = [
  col.accessor((r) => r.learner_name ?? '—', {
    id:     'learner_name',
    header: 'Learner',
    cell:   (info) => <span className="font-medium text-zinc-900">{info.getValue() as string}</span>,
  }),
  col.accessor((r) => r.outcome ?? '', {
    id:     'outcome',
    header: 'Outcome',
    cell:   (info) => {
      const v = info.getValue() as string
      if (!v) return <span className="text-zinc-300">—</span>
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${OUTCOME_BADGE[v] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {v}
        </span>
      )
    },
  }),
  col.accessor((r) => r.severity ?? '', {
    id:     'severity',
    header: 'Severity',
    cell:   (info) => {
      const v = info.getValue() as string
      if (!v) return <span className="text-zinc-300">—</span>
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[v] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {v}
        </span>
      )
    },
  }),
  col.accessor((r) => r.accountable_team ?? '', {
    id:     'accountable_team',
    header: 'Team',
    cell:   (info) => {
      const v = info.getValue() as string
      return v
        ? <span className="text-xs text-zinc-700">{v}</span>
        : <span className="text-zinc-300">—</span>
    },
  }),
  col.accessor((r) => r.opened_at ?? '', {
    id:     'opened_at',
    header: 'Opened',
    cell:   (info) => <span className="text-xs text-zinc-500">{fmtDate(info.getValue() as string | null)}</span>,
    sortingFn: 'alphanumeric',
  }),
  col.accessor((r) => r.closed_at ?? '', {
    id:     'closed_at',
    header: 'Closed',
    cell:   (info) => <span className="text-xs text-zinc-500">{fmtDate(info.getValue() as string | null)}</span>,
    sortingFn: 'alphanumeric',
  }),
  col.accessor((r) => r.closed_by_name ?? '', {
    id:     'closed_by_name',
    header: 'Closed by',
    cell:   (info) => {
      const v = info.getValue() as string
      return v ? <span className="text-xs text-zinc-700">{v}</span> : <span className="text-zinc-300">—</span>
    },
  }),
  col.accessor((r) => (r.interventions ?? []).length, {
    id:     'interventions_count',
    header: 'Interventions',
    cell:   (info) => {
      const r = info.row.original
      const done  = (r.interventions ?? []).filter((it) => !!it.completed_at).length
      const total = (r.interventions ?? []).length
      if (total === 0) return <span className="text-xs text-zinc-300">—</span>
      return <span className="text-xs tabular-nums text-zinc-700">{done}/{total}</span>
    },
  }),
]

export default function ClosedCasesTable({ rows }: Props) {
  // Default to most recently closed first.
  const [sorting, setSorting]         = useState<SortingState>([{ id: 'closed_at', desc: true }])
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const table = useReactTable({
    data:    rows,
    columns,
    state:   { sorting },
    onSortingChange:   setSorting,
    getCoreRowModel:   getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  })

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-400">No closed cases yet.</p>
  }

  const colSpan = columns.length + 1

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Scroll container — vertical for long lists, horizontal so the
          Learner column can stay pinned while everything else slides. */}
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <table className="w-full border-collapse text-sm" style={{ minWidth: 880 }}>
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
              {/* Chevron column header — pinned alongside the learner name. */}
              <th className="sticky left-0 top-0 z-30 w-8 bg-zinc-50 px-2 py-2"></th>
              {table.getFlatHeaders().map((header) => {
                const canSort  = header.column.getCanSort()
                const sortDir  = header.column.getIsSorted()
                const isLearner = header.column.id === 'learner_name'
                return (
                  <th
                    key={header.id}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    className={`sticky top-0 bg-zinc-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${
                      canSort   ? 'cursor-pointer select-none hover:text-zinc-700' : ''
                    } ${
                      isLearner ? 'left-8 z-30 border-r border-zinc-200' : 'z-20'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortDir === 'asc'  && <span>↑</span>}
                      {sortDir === 'desc' && <span>↓</span>}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const isOpen = expanded.has(row.original.id)
              // Per-row sticky background needs to track the row's own
              // background so the pinned cells don't show through on hover.
              const rowBg     = isOpen ? 'bg-zinc-50/60' : 'bg-white group-hover:bg-zinc-50'
              return (
                <Fragment key={row.id}>
                  <tr
                    onClick={() => toggle(row.original.id)}
                    className="group cursor-pointer border-t border-zinc-100 hover:bg-zinc-50"
                  >
                    <td className={`sticky left-0 z-10 px-2 py-2 text-center text-zinc-400 ${rowBg}`}>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`inline-block h-3 w-3 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      >
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                      </svg>
                    </td>
                    {row.getVisibleCells().map((cell) => {
                      const isLearner = cell.column.id === 'learner_name'
                      return (
                        <td
                          key={cell.id}
                          className={`px-3 py-2 ${
                            isLearner ? `sticky left-8 z-10 border-r border-zinc-200 ${rowBg}` : ''
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-zinc-100 bg-zinc-50/60">
                      <td colSpan={colSpan} className="px-4 py-4">
                        <CaseHistory
                          history={[row.original]}
                          heading={null}
                          fallbackLearnerId={row.original.learner_id ?? undefined}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
