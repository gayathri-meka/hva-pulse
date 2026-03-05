'use client'

import { useState, useTransition, Suspense } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type RowSelectionState,
  type ColumnSizingState,
} from '@tanstack/react-table'

const SIZING_KEY = 'hva-col-applications'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}
import Link from 'next/link'
import { updateApplicationStatus, bulkUpdateApplicationStatus } from '@/app/(protected)/placements/actions'
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

const NS_REASONS = [
  'Skill Mismatch',
  'Eligibility Mismatch',
  'Location Mismatch',
  'Blacklisted',
  'Joining Date Mismatch',
  'Other',
]

const REJECTION_REASONS = [
  'Gap in technical skills',
  'Gap in communication skills',
  'Copied',
  'Other',
]

type PendingChange =
  | { bulk: false; id: string;       newStatus: 'not_shortlisted' | 'rejected' }
  | { bulk: true;  ids: string[];    newStatus: 'not_shortlisted' | 'rejected' }
  | null

const col = createColumnHelper<ApplicationWithLearner>()

interface Props {
  applications: ApplicationWithLearner[]
  statusCounts: Record<string, number>
  total: number
}

export default function ApplicationsList({ applications, statusCounts, total }: Props) {
  const [sorting, setSorting]           = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadSizing)
  const [statusMap, setStatusMap]       = useState<Record<string, string>>(() =>
    Object.fromEntries(applications.map((a) => [a.id, a.status]))
  )
  const [pendingChange, setPendingChange]   = useState<PendingChange>(null)
  const [noteText, setNoteText]             = useState('')
  const [checkedReasons, setCheckedReasons] = useState<Set<string>>(new Set())
  const [reasonsError, setReasonsError]     = useState(false)
  const [bulkSelect, setBulkSelect]         = useState('')
  const [, startTransition] = useTransition()

  function openModal(change: NonNullable<PendingChange>) {
    setPendingChange(change)
    setNoteText('')
    setCheckedReasons(new Set())
    setReasonsError(false)
  }

  function handleStatusChange(id: string, newStatus: string) {
    if (newStatus === 'not_shortlisted' || newStatus === 'rejected') {
      openModal({ bulk: false, id, newStatus })
      return
    }
    setStatusMap((prev) => ({ ...prev, [id]: newStatus }))
    startTransition(() => updateApplicationStatus(id, newStatus))
  }

  function handleBulkStatusChange(newStatus: string) {
    if (!newStatus) return
    const ids = selectedApplications.map((a) => a.id)
    if (newStatus === 'not_shortlisted' || newStatus === 'rejected') {
      openModal({ bulk: true, ids, newStatus })
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
        const note = (() => {
          if (currentStatus === 'not_shortlisted') {
            const reasons = info.row.original.not_shortlisted_reasons ?? []
            const comment = info.row.original.not_shortlisted_reason
            if (reasons.length > 0) return reasons.join(', ') + (comment ? ` — ${comment}` : '')
            return comment  // backward compat
          }
          if (currentStatus === 'rejected') {
            const reasons = info.row.original.rejection_reasons ?? []
            const comment = info.row.original.rejection_feedback
            if (reasons.length > 0) return reasons.join(', ') + (comment ? ` — ${comment}` : '')
            return comment  // backward compat
          }
          return null
        })()
        return (
          <div>
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
            {note && <ExpandableNote note={note} />}
          </div>
        )
      },
    }),
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
    state: { sorting, rowSelection, columnSizing },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
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
    enableRowSelection: true,
  })

  const selectedApplications = applications.filter((a) => rowSelection[a.id])
  const selectedCount        = Object.keys(rowSelection).length

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Suspense>
          <StatusFilter statusCounts={statusCounts} total={total} />
        </Suspense>
        <div className="flex items-center gap-2">
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
          <ExportButton applications={selectedApplications} disabled={selectedCount === 0} />
        </div>
      </div>

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
                    className="relative select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400"
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

      {/* Reason / feedback modal */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleModalCancel} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
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
                ? pendingChange.bulk
                  ? "Why weren't these candidates shortlisted?"
                  : "Why wasn't this candidate shortlisted?"
                : pendingChange.bulk
                  ? 'Why were these candidates rejected?'
                  : 'Why was this candidate rejected?'}
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
                  {reasonsError && (
                    <p className="mt-1 text-xs text-red-600">Select at least one reason.</p>
                  )}
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
    </div>
  )
}
