'use client'

import { useEffect, useMemo, useState } from 'react'
import { exportToCsv } from '@/lib/exportToCsv'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type ColumnSizingState,
  type SortingState,
} from '@tanstack/react-table'
import { paceMetrics, type PaceMetrics } from '@/lib/challengePace'
import type { Member } from './ChallengeClient'

const SIZING_KEY = 'hva-col-challenge-pace'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

type Row = Member & { metrics: PaceMetrics }

// "2026-06-17" -> "17 Jun" (deterministic locale so SSR/client agree).
function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Heat tone for a per-day task count.
function heat(count: number): string {
  if (count <= 0) return 'text-zinc-300'
  if (count === 1) return 'bg-emerald-50 text-emerald-700'
  if (count <= 3)  return 'bg-emerald-100 text-emerald-800'
  if (count <= 6)  return 'bg-emerald-200 text-emerald-900'
  return 'bg-emerald-400 text-white'
}

function Sparkline({ metrics }: { metrics: PaceMetrics }) {
  if (!metrics.series.length) return <span className="text-zinc-300">—</span>
  const max = Math.max(...metrics.series.map((s) => s.count), 1)
  return (
    <div className="flex h-6 items-end gap-px">
      {metrics.series.map((s) => (
        <div
          key={s.day}
          title={`Day ${s.day} · ${dateLabel(s.date)} — ${s.count} task${s.count === 1 ? '' : 's'}`}
          className={`min-w-[2px] flex-1 rounded-sm ${s.count ? 'bg-[#5BAE5B]' : 'bg-zinc-100'}`}
          style={{ height: s.count ? `${Math.max(12, (s.count / max) * 100)}%` : '2px' }}
        />
      ))}
    </div>
  )
}

// One-line descriptions shown under the summary-column headers.
const COL_DESC: Record<string, string> = {
  active:   'days with activity',
  span:     'first → last (days)',
  cramming: 'busiest day ÷ total tasks',
}

const col = createColumnHelper<Row>()

export default function ChallengePaceTable({
  members,
  calendarDates,
}: {
  members: Member[]
  calendarDates: string[]
}) {
  const [sorting, setSorting]           = useState<SortingState>([{ id: 'active', desc: true }])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [search, setSearch]             = useState('')

  useEffect(() => {
    const saved = loadSizing()
    if (Object.keys(saved).length) setColumnSizing(saved)
  }, [])

  const data = useMemo<Row[]>(
    () => members.map((m) => ({ ...m, metrics: paceMetrics(m.activityByDate) })),
    [members],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data
    return data.filter((m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
  }, [data, search])

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Member',
        size: 190,
        cell: (info) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-zinc-900">{info.getValue() || '—'}</div>
            <div className="truncate text-xs text-zinc-400">{info.row.original.email}</div>
          </div>
        ),
      }),
      col.accessor((r) => r.metrics.activeDays, {
        id: 'active',
        header: 'Active days',
        size: 104,
        cell: (info) => <span className="text-zinc-700">{info.getValue() || '—'}</span>,
      }),
      col.accessor((r) => r.metrics.spanDays, {
        id: 'span',
        header: 'Span',
        size: 100,
        cell: (info) => {
          const v = info.getValue() as number
          return <span className="text-zinc-700">{v ? `${v}d` : '—'}</span>
        },
      }),
      col.accessor((r) => r.metrics.crammingPct, {
        id: 'cramming',
        header: 'Cramming',
        size: 128,
        cell: (info) => {
          const v = info.getValue() as number
          const m = info.row.original.metrics
          if (!m.total) return <span className="text-zinc-300">—</span>
          const crammed = v >= 60 && m.total >= 3
          return (
            <span className={crammed ? 'font-semibold text-amber-700' : 'text-zinc-600'}>
              {v}%{crammed ? ' ⚠' : ''}
            </span>
          )
        },
      }),
      col.display({
        id: 'spark',
        header: 'Activity (their day 1 →)',
        size: 150,
        cell: (info) => <Sparkline metrics={info.row.original.metrics} />,
      }),
      ...calendarDates.map((date) =>
        col.accessor((r) => r.activityByDate[date] ?? 0, {
          id: `d_${date}`,
          header: dateLabel(date),
          size: 40,
          enableSorting: false,
          enableResizing: false,
          cell: (info) => {
            const v = info.getValue() as number
            return (
              <div className={`mx-auto h-6 w-6 rounded text-center text-[11px] leading-6 ${heat(v)}`}>
                {v || ''}
              </div>
            )
          },
        }),
      ),
    ],
    [calendarDates],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnSizing, columnPinning: { left: ['name', 'active', 'span', 'cramming', 'spark'] } },
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
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    getRowId: (row) => row.email,
  })

  if (members.length === 0) {
    return <p className="text-sm text-zinc-400">No one has joined the challenge cohort yet.</p>
  }

  const totalCount   = members.length
  const visibleCount = table.getRowModel().rows.length
  const countLabel   = visibleCount === totalCount
    ? `${totalCount} member${totalCount === 1 ? '' : 's'}`
    : `${visibleCount} of ${totalCount}`

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            >
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-56 rounded-lg border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
            />
          </div>
          <span className="whitespace-nowrap text-xs font-medium text-zinc-500">{countLabel}</span>
          <span className="hidden whitespace-nowrap text-xs text-zinc-400 md:inline">
            Sparkline = tasks per their own day · heat columns = tasks per calendar date (IST)
          </span>
        </div>
        <button
          onClick={() => exportToCsv(table, `challenge_pace_${new Date().toISOString().slice(0, 10)}.csv`)}
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

      <div className="w-fit max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <table className="border-separate text-sm" style={{ tableLayout: 'fixed', width: table.getTotalSize(), borderSpacing: 0 }}>
            <thead>
              <tr className="bg-zinc-50 text-left">
                {table.getFlatHeaders().map((header) => {
                  const pinned       = header.column.getIsPinned() === 'left'
                  const isLastPinned = pinned && header.column.getIsLastColumn('left')
                  const left         = pinned ? header.column.getStart('left') : undefined
                  const isDate       = header.column.id.startsWith('d_')
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), left }}
                      className={`sticky top-0 select-none border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${
                        pinned ? 'z-20' : 'z-10'
                      } ${isLastPinned ? 'border-r border-zinc-200' : ''} ${isDate ? 'px-0 py-3 align-middle' : 'px-4 py-3'}`}
                    >
                      {isDate ? (
                        (() => {
                          const iso = header.column.id.slice(2)
                          const day = iso.slice(8, 10)
                          const mon = new Date(`${iso}T00:00:00Z`)
                            .toLocaleDateString('en-GB', { month: 'short' })
                            .toUpperCase()
                          return (
                            <div className="flex flex-col items-center leading-none">
                              <span className="text-xs font-semibold text-zinc-600">{day}</span>
                              <span className="mt-0.5 text-[9px] font-semibold tracking-wide text-zinc-400">{mon}</span>
                            </div>
                          )
                        })()
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <div
                            className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                            {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                          </div>
                          {COL_DESC[header.column.id] && (
                            <span className="text-[10px] font-normal normal-case leading-tight tracking-normal text-zinc-400">
                              {COL_DESC[header.column.id]}
                            </span>
                          )}
                        </div>
                      )}
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={(e) => { e.stopPropagation(); header.getResizeHandler()(e) }}
                          onTouchStart={(e) => { e.stopPropagation(); header.getResizeHandler()(e) }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ touchAction: 'none' }}
                          title="Drag to resize"
                          className="group/resize absolute right-0 top-0 z-20 flex h-full w-2 cursor-col-resize justify-end"
                        >
                          <div className={`h-full w-0.5 ${header.column.getIsResizing() ? 'bg-[#5BAE5B]' : 'bg-zinc-200 group-hover/resize:bg-[#5BAE5B]'}`} />
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="group hover:bg-zinc-50">
                  {row.getVisibleCells().map((cell) => {
                    const pinned       = cell.column.getIsPinned() === 'left'
                    const isLastPinned = pinned && cell.column.getIsLastColumn('left')
                    const left         = pinned ? cell.column.getStart('left') : undefined
                    const isDate       = cell.column.id.startsWith('d_')
                    return (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize(), left }}
                        className={`border-b border-zinc-100 ${isDate ? 'px-0 py-1.5' : 'truncate px-4 py-3'} ${
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
