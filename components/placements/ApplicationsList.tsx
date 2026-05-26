'use client'

import { useState, useTransition, Suspense, useEffect, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
  type ColumnSizingState,
  type ColumnFiltersState,
  type FilterFn,
  type Column,
} from '@tanstack/react-table'

const SIZING_KEY = 'hva-col-applications'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

// Row passes if ANY of its array reasons is in the selected filter values.
const arrayAnyFilter: FilterFn<unknown> = (row, colId, filterValues: string[]) => {
  if (!filterValues?.length) return true
  const cellValue = row.getValue(colId)
  if (!Array.isArray(cellValue) || cellValue.length === 0) return false
  return cellValue.some((v) => filterValues.includes(String(v)))
}
arrayAnyFilter.autoRemove = (val: string[]) => !val?.length

function ReasonFilterDropdown({
  column,
  options,
}: {
  column:  Column<unknown, unknown>
  options: string[]
}) {
  const [open, setOpen]  = useState(false)
  const containerRef     = useRef<HTMLDivElement>(null)
  const selected         = (column.getFilterValue() as string[]) ?? []

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  function toggle(val: string) {
    const next = selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    column.setFilterValue(next.length ? next : undefined)
  }

  const label =
    selected.length === 0 ? 'All'
    : selected.length === 1 ? selected[0]
    : `${selected.length} selected`

  return (
    <div ref={containerRef} className="relative mt-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
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
        <div className="absolute left-0 top-full z-30 mt-0.5 max-h-64 min-w-[220px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); column.setFilterValue(undefined); setOpen(false) }}
              className="w-full border-b border-zinc-100 px-3 py-1 text-left text-xs text-blue-500 hover:bg-zinc-50"
            >
              Clear filter
            </button>
          )}
          {options.map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
import Link from 'next/link'
import { updateApplicationStatus, bulkUpdateApplicationStatus, updateApplicationReasons } from '@/app/(protected)/placements/actions'
import ExportButton from './ExportButton'
import StatusFilter from './StatusFilter'
import ExpandableNote from '@/components/ui/ExpandableNote'
import type { ApplicationWithLearner } from '@/types'

const STATUS_OPTIONS = ['applied', 'shortlisted', 'interviews_ongoing', 'on_hold', 'not_shortlisted', 'rejected', 'hired'] as const
const STATUS_LABEL: Record<string, string> = {
  applied:             'Applied',
  shortlisted:         'Shortlisted',
  interviews_ongoing:  'Interviews Ongoing',
  on_hold:             'On Hold',
  not_shortlisted:     'Not Shortlisted',
  rejected:            'Rejected',
  hired:               'Hired',
}
const STATUS_BADGE: Record<string, string> = {
  applied:             'bg-blue-100 text-blue-700',
  shortlisted:         'bg-amber-100 text-amber-700',
  interviews_ongoing:  'bg-violet-100 text-violet-700',
  on_hold:             'bg-orange-100 text-orange-700',
  not_shortlisted:     'bg-zinc-100 text-zinc-600',
  rejected:            'bg-red-100 text-red-700',
  hired:               'bg-emerald-100 text-emerald-700',
}
const STATUS_SORT_ORDER: Record<string, number> = {
  applied: 0, shortlisted: 1, interviews_ongoing: 2, on_hold: 3, hired: 4, not_shortlisted: 5, rejected: 6,
}

const DEFAULT_NS_REASONS = [
  'Skill Mismatch',
  'Eligibility Mismatch',
  'Location Mismatch',
  'Blacklisted',
  'Joining Date Mismatch',
  'Other',
]

const DEFAULT_REJECTION_REASONS = [
  'Gap in technical skills',
  'Gap in communication skills',
  'Didn\'t submit assignment',
  'Interview no-show',
  'Copied',
  'Other',
]

type PendingChange =
  | { bulk: false; id: string;       newStatus: 'not_shortlisted' | 'rejected' | 'hired' }
  | { bulk: true;  ids: string[];    newStatus: 'not_shortlisted' | 'rejected' | 'hired' }
  | null

const col = createColumnHelper<ApplicationWithLearner>()

interface Props {
  applications: ApplicationWithLearner[]
  statusCounts: Record<string, number>
  total: number
  nsReasons?: string[]
  rejectionReasons?: string[]
  statusFilter?: string
}

export default function ApplicationsList({ applications, statusCounts, total, nsReasons, rejectionReasons, statusFilter = '' }: Props) {
  const NS_REASONS = nsReasons ?? DEFAULT_NS_REASONS
  const REJECTION_REASONS = rejectionReasons ?? DEFAULT_REJECTION_REASONS
  // Show reason columns only when the matching status filter pill is active.
  const showNsReasonColumn       = statusFilter === 'not_shortlisted'
  const showRejectionReasonColumn = statusFilter === 'rejected'
  const [sorting, setSorting]               = useState<SortingState>([])
  const [rowSelection, setRowSelection]     = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing]     = useState<ColumnSizingState>(loadSizing)
  const [columnFilters, setColumnFilters]   = useState<ColumnFiltersState>([])
  const [statusMap, setStatusMap]       = useState<Record<string, string>>(() =>
    Object.fromEntries(applications.map((a) => [a.id, a.status]))
  )
  const [pendingChange, setPendingChange]   = useState<PendingChange>(null)
  const [noteText, setNoteText]             = useState('')
  const [checkedReasons, setCheckedReasons] = useState<Set<string>>(new Set())
  const [reasonsError, setReasonsError]     = useState(false)
  const [salaryText, setSalaryText]         = useState('')
  const [placementDate, setPlacementDate]   = useState(() => new Date().toISOString().slice(0, 10))
  const [editingReasons, setEditingReasons] = useState<{ id: string; status: 'not_shortlisted' | 'rejected'; reasons: Set<string>; note: string } | null>(null)
  const [bulkSelect, setBulkSelect]         = useState('')
  const [, startTransition] = useTransition()

  function openModal(change: NonNullable<PendingChange>) {
    setPendingChange(change)
    setNoteText('')
    setCheckedReasons(new Set())
    setReasonsError(false)
    setSalaryText('')
    setPlacementDate(new Date().toISOString().slice(0, 10))
  }

  function handleStatusChange(id: string, newStatus: string) {
    if (newStatus === 'not_shortlisted' || newStatus === 'rejected' || newStatus === 'hired') {
      openModal({ bulk: false, id, newStatus: newStatus as 'not_shortlisted' | 'rejected' | 'hired' })
      return
    }
    setStatusMap((prev) => ({ ...prev, [id]: newStatus }))
    startTransition(() => updateApplicationStatus(id, newStatus))
  }

  function handleBulkStatusChange(newStatus: string) {
    if (!newStatus) return
    const ids = selectedApplications.map((a) => a.id)
    if (newStatus === 'not_shortlisted' || newStatus === 'rejected' || newStatus === 'hired') {
      openModal({ bulk: true, ids, newStatus: newStatus as 'not_shortlisted' | 'rejected' | 'hired' })
      setBulkSelect('')
      return
    }
    setStatusMap((prev) => Object.fromEntries(
      Object.entries(prev).map(([k, v]) => [k, ids.includes(k) ? newStatus : v])
    ))
    startTransition(() => bulkUpdateApplicationStatus(ids, newStatus))
    setRowSelection({})
    setBulkSelect('')
  }

  function handleModalConfirm() {
    const change = pendingChange!

    // Hired — no reasons required, just optional salary + placement date
    if (change.newStatus === 'hired') {
      const salary = salaryText ? parseFloat(salaryText) : undefined
      if (change.bulk) {
        setStatusMap((prev) => Object.fromEntries(
          Object.entries(prev).map(([k, v]) => [k, change.ids.includes(k) ? 'hired' : v])
        ))
        startTransition(() => bulkUpdateApplicationStatus(change.ids, 'hired'))
        setRowSelection({})
      } else {
        setStatusMap((prev) => ({ ...prev, [change.id]: 'hired' }))
        startTransition(() => updateApplicationStatus(change.id, 'hired', undefined, undefined, salary, placementDate))
      }
      setPendingChange(null)
      setSalaryText('')
      return
    }

    if (checkedReasons.size === 0) { setReasonsError(true); return }

    const reasons = Array.from(checkedReasons)
    const note    = noteText.trim() || undefined

    if (change.bulk) {
      setStatusMap((prev) => Object.fromEntries(
        Object.entries(prev).map(([k, v]) => [k, change.ids.includes(k) ? change.newStatus : v])
      ))
      startTransition(() => bulkUpdateApplicationStatus(change.ids, change.newStatus, note, reasons))
      setRowSelection({})
    } else {
      setStatusMap((prev) => ({ ...prev, [change.id]: change.newStatus }))
      startTransition(() => updateApplicationStatus(change.id, change.newStatus, note, reasons))
    }
    setPendingChange(null)
    setNoteText('')
    setCheckedReasons(new Set())
    setReasonsError(false)
  }

  function handleModalCancel() {
    setPendingChange(null)
    setNoteText('')
    setCheckedReasons(new Set())
    setReasonsError(false)
    setSalaryText('')
    setPlacementDate(new Date().toISOString().slice(0, 10))
  }

  const columns = [
    col.display({
      id: 'select',
      size: 48,
      enableResizing: false,
      enableSorting: false,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
          className="rounded border-zinc-300"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={row.getToggleSelectedHandler()}
          className="rounded border-zinc-300"
        />
      ),
    }),
    col.accessor('learner_name', {
      header: 'Learner',
      size: 200,
      cell: (info) => (
        <div>
          <Link
            href={`/learners?tab=snapshot&learner=${info.row.original.learner_id}`}
            className="font-medium text-zinc-900 hover:text-[#5BAE5B] hover:underline"
          >
            {info.getValue()}
          </Link>
          <p className="text-xs text-zinc-400">{info.row.original.learner_email}</p>
        </div>
      ),
    }),
    col.accessor('company_name', {
      header: 'Company / Role',
      size: 200,
      cell: (info) => (
        <div>
          <p className="font-medium text-zinc-900">{info.getValue()}</p>
          <p className="text-xs text-zinc-400">{info.row.original.role_title}</p>
        </div>
      ),
    }),
    col.accessor('location', {
      header: 'Location',
      size: 140,
      cell: (info) => <span className="text-xs text-zinc-500">{info.getValue()}</span>,
    }),
    col.accessor('resume_url', {
      header: 'Resume',
      size: 80,
      enableSorting: false,
      cell: (info) =>
        info.getValue() ? (
          <a
            href={info.getValue()!}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-[#5BAE5B] hover:underline"
          >
            View
          </a>
        ) : (
          <span className="text-xs text-zinc-400">—</span>
        ),
    }),
    col.accessor('status', {
      header: 'Status',
      size: 160,
      sortingFn: (rowA, rowB) => {
        const a = STATUS_SORT_ORDER[statusMap[rowA.original.id] ?? rowA.original.status] ?? 99
        const b = STATUS_SORT_ORDER[statusMap[rowB.original.id] ?? rowB.original.status] ?? 99
        return a - b
      },
      cell: (info) => {
        const id            = info.row.original.id
        const currentStatus =
          (pendingChange && !pendingChange.bulk && pendingChange.id === id)
            ? pendingChange.newStatus
            : (statusMap[id] ?? info.getValue())
        return (
          <div className="relative inline-flex">
            <select
              value={currentStatus}
              onChange={(e) => handleStatusChange(id, e.target.value)}
              className={`appearance-none cursor-pointer rounded-full border-0 pl-2.5 pr-6 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 ${
                STATUS_BADGE[currentStatus] ?? 'bg-zinc-100 text-zinc-600'
              }`}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s] ?? s}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )
      },
    }),
    ...(showNsReasonColumn ? [
      col.accessor((row) => row.not_shortlisted_reasons ?? [], {
        id:        'not_shortlisted_reasons',
        header:    'Not Shortlisted Reason',
        size:      220,
        filterFn:  arrayAnyFilter as FilterFn<ApplicationWithLearner>,
        sortingFn: (a, b) => {
          const av = (a.original.not_shortlisted_reasons ?? []).join(', ')
          const bv = (b.original.not_shortlisted_reasons ?? []).join(', ')
          return av.localeCompare(bv)
        },
        cell: (info) => {
          const row     = info.row.original
          const reasons = row.not_shortlisted_reasons ?? []
          const comment = row.not_shortlisted_reason ?? ''
          const text    = reasons.length > 0
            ? reasons.join(', ') + (comment ? ` — ${comment}` : '')
            : (comment || '—')
          return (
            <div className="flex items-start gap-1.5">
              <div className="flex-1 min-w-0 text-xs text-zinc-700">
                <ExpandableNote note={text} />
              </div>
              <button
                type="button"
                onClick={() => setEditingReasons({ id: row.id, status: 'not_shortlisted', reasons: new Set(reasons), note: comment })}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                title="Edit reasons"
                aria-label="Edit reasons"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M2.695 14.762l-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
                </svg>
              </button>
            </div>
          )
        },
      }),
    ] : []),
    ...(showRejectionReasonColumn ? [
      col.accessor((row) => row.rejection_reasons ?? [], {
        id:        'rejection_reasons',
        header:    'Reject Reason',
        size:      220,
        filterFn:  arrayAnyFilter as FilterFn<ApplicationWithLearner>,
        sortingFn: (a, b) => {
          const av = (a.original.rejection_reasons ?? []).join(', ')
          const bv = (b.original.rejection_reasons ?? []).join(', ')
          return av.localeCompare(bv)
        },
        cell: (info) => {
          const row     = info.row.original
          const reasons = row.rejection_reasons ?? []
          const comment = row.rejection_feedback ?? ''
          const text    = reasons.length > 0
            ? reasons.join(', ') + (comment ? ` — ${comment}` : '')
            : (comment || '—')
          return (
            <div className="flex items-start gap-1.5">
              <div className="flex-1 min-w-0 text-xs text-zinc-700">
                <ExpandableNote note={text} />
              </div>
              <button
                type="button"
                onClick={() => setEditingReasons({ id: row.id, status: 'rejected', reasons: new Set(reasons), note: comment })}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                title="Edit reasons"
                aria-label="Edit reasons"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M2.695 14.762l-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.886L17.5 5.501a2.121 2.121 0 0 0-3-3L3.58 13.419a4 4 0 0 0-.885 1.343Z" />
                </svg>
              </button>
            </div>
          )
        },
      }),
    ] : []),
    col.accessor('created_at', {
      header: 'Applied',
      size: 110,
      cell: (info) => (
        <span className="text-xs text-zinc-400">
          {new Date(info.getValue()).toLocaleDateString('en-GB')}
        </span>
      ),
    }),
  ]

  const table = useReactTable({
    data: applications,
    columns,
    state: { sorting, rowSelection, columnSizing, columnFilters },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
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
    columnResizeMode: 'onChange',
    getRowId: (row) => row.id,
    enableRowSelection: true,
  })

  const selectedApplications = applications.filter((a) => rowSelection[a.id])
  const selectedCount        = Object.keys(rowSelection).length

  const filteredRowCount = table.getRowModel().rows.length
  const hasColumnFilter  = columnFilters.length > 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Suspense>
          <StatusFilter statusCounts={statusCounts} total={total} />
        </Suspense>
        <div className="flex items-center gap-2">
          {hasColumnFilter && (
            <span className="text-xs text-zinc-500">
              {filteredRowCount} of {applications.length}
            </span>
          )}
          {selectedCount > 0 && (
            <>
              <span className="text-xs text-zinc-500">{selectedCount} selected</span>
              <div className="relative">
                <select
                  value={bulkSelect}
                  onChange={(e) => handleBulkStatusChange(e.target.value)}
                  className="appearance-none rounded-lg border border-zinc-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
                >
                  <option value="">Change status…</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </>
          )}
          <ExportButton applications={applications} />
        </div>
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
                    className="sticky top-0 z-10 bg-zinc-50 relative select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    <div
                      className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                      {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                    </div>
                    {header.column.id === 'not_shortlisted_reasons' && (
                      <ReasonFilterDropdown column={header.column as Column<unknown, unknown>} options={NS_REASONS} />
                    )}
                    {header.column.id === 'rejection_reasons' && (
                      <ReasonFilterDropdown column={header.column as Column<unknown, unknown>} options={REJECTION_REASONS} />
                    )}
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
                  className={row.getIsSelected() ? 'bg-zinc-50' : 'hover:bg-zinc-50'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-4 py-3.5"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {applications.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-zinc-400">
                    No applications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status modal */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleModalCancel} />
          <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">

            {pendingChange.newStatus === 'hired' ? (
              /* ── Hire modal ─────────────────────────────────────── */
              <>
                <h3 className="mb-1 text-base font-semibold text-zinc-900">
                  Mark as Hired
                  {pendingChange.bulk && (
                    <span className="ml-2 text-sm font-normal text-zinc-400">
                      · {pendingChange.ids.length} learner{pendingChange.ids.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                <p className="mb-4 text-sm text-zinc-500">
                  {pendingChange.bulk
                    ? 'Salary will not be recorded for bulk hires.'
                    : 'Optionally record the salary — this will appear in the Alumni table.'}
                </p>
                {!pendingChange.bulk && (
                  <>
                    <label className="block text-xs font-medium text-zinc-500">
                      Salary (LPA) <span className="text-zinc-400">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={salaryText}
                      onChange={(e) => setSalaryText(e.target.value)}
                      placeholder="e.g. 8.5"
                      className="mt-1 mb-3 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                    />
                    <label className="block text-xs font-medium text-zinc-500">
                      Date of Placement
                    </label>
                    <input
                      type="date"
                      value={placementDate}
                      onChange={(e) => setPlacementDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                    />
                  </>
                )}
              </>
            ) : (
              /* ── Not shortlisted / Rejected modal ───────────────── */
              <>
                <h3 className="mb-1 text-base font-semibold text-zinc-900">
                  {pendingChange.newStatus === 'not_shortlisted' ? 'Not Shortlisted' : 'Rejected'}
                  {pendingChange.bulk && (
                    <span className="ml-2 text-sm font-normal text-zinc-400">
                      · {pendingChange.ids.length} learner{pendingChange.ids.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </h3>
                <p className="mb-4 text-sm text-zinc-500">
                  {pendingChange.newStatus === 'not_shortlisted'
                    ? pendingChange.bulk ? "Why weren't these candidates shortlisted?" : "Why wasn't this candidate shortlisted?"
                    : pendingChange.bulk ? 'Why were these candidates rejected?' : 'Why was this candidate rejected?'}
                </p>
                {(() => {
                  const reasons = pendingChange.newStatus === 'not_shortlisted' ? NS_REASONS : REJECTION_REASONS
                  const placeholder = pendingChange.newStatus === 'not_shortlisted'
                    ? 'e.g. Stronger candidates were selected for this round'
                    : 'e.g. Needs more depth in system design'
                  return (
                    <>
                      <div className={`space-y-2.5 rounded-lg border p-3 ${reasonsError ? 'border-red-300 bg-red-50' : 'border-zinc-200'}`}>
                        {reasons.map((reason) => (
                          <label key={reason} className="flex cursor-pointer items-center gap-3">
                            <input
                              type="checkbox"
                              checked={checkedReasons.has(reason)}
                              onChange={(e) => {
                                setCheckedReasons((prev) => {
                                  const next = new Set(prev)
                                  e.target.checked ? next.add(reason) : next.delete(reason)
                                  return next
                                })
                                setReasonsError(false)
                              }}
                              className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                            />
                            <span className="text-sm text-zinc-700">{reason}</span>
                          </label>
                        ))}
                      </div>
                      {reasonsError && <p className="mt-1 text-xs text-red-600">Select at least one reason.</p>}
                      <label className="mt-3 block text-xs font-medium text-zinc-500">
                        Additional details <span className="text-zinc-400">(optional)</span>
                      </label>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={2}
                        placeholder={placeholder}
                        className="mt-1 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                      />
                    </>
                  )
                })()}
              </>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={handleModalCancel}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleModalConfirm}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit reasons modal */}
      {editingReasons && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6">
            <h2 className="mb-1 text-base font-semibold text-zinc-900">
              Edit {editingReasons.status === 'not_shortlisted' ? 'Not Shortlisted' : 'Rejection'} Reasons
            </h2>
            <p className="mb-4 text-xs text-zinc-400">Update the reasons and note for this application.</p>

            <div className="space-y-1.5 mb-4">
              {(editingReasons.status === 'not_shortlisted' ? NS_REASONS : REJECTION_REASONS).map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-zinc-50">
                  <input
                    type="checkbox"
                    checked={editingReasons.reasons.has(r)}
                    onChange={() => setEditingReasons((prev) => {
                      if (!prev) return prev
                      const next = new Set(prev.reasons)
                      next.has(r) ? next.delete(r) : next.add(r)
                      return { ...prev, reasons: next }
                    })}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                  />
                  <span className="text-sm text-zinc-700">{r}</span>
                </label>
              ))}
            </div>

            <textarea
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
              rows={2}
              placeholder="Additional note (optional)"
              value={editingReasons.note}
              onChange={(e) => setEditingReasons((prev) => prev ? { ...prev, note: e.target.value } : prev)}
            />

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setEditingReasons(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!editingReasons) return
                  const reasons = Array.from(editingReasons.reasons)
                  const note = editingReasons.note.trim() || undefined
                  startTransition(async () => {
                    await updateApplicationReasons(editingReasons.id, reasons, note)
                    setEditingReasons(null)
                  })
                }}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
