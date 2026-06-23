'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import type { Prospect } from './page'
import ChallengeStatusBadge from '@/components/admissions/ChallengeStatusBadge'
import CommentsCell from '@/components/admissions/CommentsCell'
import { normEmail, type ProspectComment } from '@/lib/prospectComments'

const SIZING_KEY = 'hva-col-prospects'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

function formatLabel(value: string | null): string {
  if (!value) return '—'
  return value.includes('_')
    ? value.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
    : value
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

const multiSelectFilter: FilterFn<Prospect> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

const col = createColumnHelper<Prospect>()

export default function ProspectsTable({
  prospects,
  commentsByEmail,
  currentUserId,
  isAdmin,
}: {
  prospects: Prospect[]
  commentsByEmail: Record<string, ProspectComment[]>
  currentUserId: string
  isAdmin: boolean
}) {
  const [sorting, setSorting]             = useState<SortingState>([])
  const [columnSizing, setColumnSizing]   = useState<ColumnSizingState>({})
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [search, setSearch]               = useState('')

  // Load saved column widths after mount (not during render) so SSR markup and
  // the client's first render match — reading localStorage in a useState
  // initializer causes a hydration mismatch on the width style attributes.
  useEffect(() => {
    const saved = loadSizing()
    if (Object.keys(saved).length) setColumnSizing(saved)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return prospects
    return prospects.filter(
      (p) => p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q),
    )
  }, [prospects, search])

  const columns = useMemo(
    () => [
      col.accessor('created_at', {
        header: 'Signed up',
        size: 140,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
      }),
      col.accessor('name', {
        header: 'Name',
        size: 200,
        enableColumnFilter: false,
        cell: (info) => <span className="font-medium text-zinc-900">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('email', {
        header: 'Email',
        size: 260,
        enableColumnFilter: false,
        cell: (info) => (
          <a href={`mailto:${info.getValue()}`} className="text-zinc-600 hover:text-zinc-900 hover:underline">
            {info.getValue()}
          </a>
        ),
      }),
      col.accessor('phone', {
        header: 'Phone',
        size: 130,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('college', {
        header: 'College',
        size: 240,
        filterFn: multiSelectFilter,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('education_status', {
        header: 'Education status',
        size: 220,
        filterFn: multiSelectFilter,
        cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
      }),
      col.accessor('referral_source', {
        header: 'How did they hear?',
        size: 180,
        filterFn: multiSelectFilter,
        cell: (info) => {
          const v = info.getValue()
          return v ? (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200">
              {formatLabel(v)}
            </span>
          ) : (
            <span className="text-zinc-400">—</span>
          )
        },
      }),
      col.accessor('referral_detail', {
        header: 'Referral detail',
        size: 220,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
      }),
      col.accessor((row) => (row.interest_form_submitted_at ? 'Submitted' : 'Pending'), {
        id: 'interest_form',
        header: 'Interest form',
        size: 150,
        filterFn: multiSelectFilter,
        cell: (info) =>
          info.getValue() === 'Submitted' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Submitted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
              Pending
            </span>
          ),
      }),
      col.accessor('challenge_status', {
        header: 'Challenge',
        size: 140,
        filterFn: multiSelectFilter,
        cell: (info) => <ChallengeStatusBadge status={info.getValue()} />,
      }),
      col.accessor((row) => row.interest_form_submitted_at, {
        id: 'form_fill_date',
        header: 'Form fill date',
        size: 140,
        enableColumnFilter: false,
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
          return v ? <span className="text-zinc-500">{formatDate(v)}</span> : <span className="text-zinc-300">—</span>
        },
      }),
      col.accessor('last_seen_at', {
        header: 'Last seen',
        size: 140,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-500">{formatDate(info.getValue())}</span>,
      }),
      col.display({
        id: 'comments',
        // Function header (not a plain string) so exportToCsv skips this column.
        header: () => <>Comments</>,
        size: 120,
        cell: (info) => (
          <CommentsCell
            email={info.row.original.email}
            comments={commentsByEmail[normEmail(info.row.original.email)] ?? []}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        ),
      }),
    ],
    [commentsByEmail, currentUserId, isAdmin],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, columnSizing, columnFilters, columnPinning: { left: ['created_at', 'name'] } },
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

  if (prospects.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No prospects yet.</p>
      </div>
    )
  }

  const totalCount   = prospects.length
  const visibleCount = table.getRowModel().rows.length
  const countLabel   = visibleCount === totalCount
    ? `${totalCount} row${totalCount === 1 ? '' : 's'}`
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
          <table className="border-separate text-sm" style={{ tableLayout: 'fixed', width: table.getTotalSize(), borderSpacing: 0 }}>
            <thead>
              <tr className="bg-zinc-50 text-left">
                {table.getFlatHeaders().map((header) => {
                  const pinned       = header.column.getIsPinned() === 'left'
                  const isLastPinned = pinned && header.column.getIsLastColumn('left')
                  const left         = pinned ? header.column.getStart('left') : undefined
                  return (
                    <th
                      key={header.id}
                      style={{ width: header.getSize(), left }}
                      className={`sticky top-0 select-none border-b border-zinc-200 bg-zinc-50 px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${
                        pinned ? 'z-20' : 'z-10'
                      } ${isLastPinned ? 'border-r border-zinc-200' : ''}`}
                    >
                      <div className="flex flex-col gap-1">
                        <div
                          className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                          {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                          {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                        </div>
                        {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
                      </div>
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
                    const raw          = cell.getValue()
                    const title        = typeof raw === 'string' && raw ? raw : undefined
                    return (
                      <td
                        key={cell.id}
                        title={title}
                        style={{ width: cell.column.getSize(), left }}
                        className={`truncate border-b border-zinc-100 px-6 py-3.5 ${
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

function FilterDropdown({ column }: { column: Column<Prospect, unknown> }) {
  const [open, setOpen]     = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const btnRef              = useRef<HTMLButtonElement>(null)
  const panelRef            = useRef<HTMLDivElement>(null)
  const selected            = (column.getFilterValue() as string[]) ?? []

  function reposition() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) setCoords({ top: r.bottom + 4, left: r.left })
  }

  useEffect(() => {
    if (!open) return
    reposition()
    function onOutside(e: MouseEvent) {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return
      setOpen(false)
    }
    function onScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onResize() { setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
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
    : selected.length === 1 ? formatLabel(selected[0])
    : `${selected.length} selected`

  return (
    <>
      <button
        ref={btnRef}
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
      {open && coords && createPortal(
        <div
          ref={panelRef}
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-50 max-h-52 min-w-[180px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg"
        >
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
              <span>{formatLabel(opt)}</span>
            </label>
          ))}
          {options.length === 0 && <p className="px-3 py-1 text-xs text-zinc-400">No values</p>}
        </div>,
        document.body,
      )}
    </>
  )
}
