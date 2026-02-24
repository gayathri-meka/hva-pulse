'use client'

import { useState, useTransition } from 'react'
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
import { updateApplicationStatus } from '@/app/(protected)/placements/actions'
import ExportButton from './ExportButton'
import type { ApplicationWithLearner } from '@/types'

const STATUS_OPTIONS = ['applied', 'shortlisted', 'not_shortlisted', 'rejected', 'hired'] as const
const STATUS_LABEL: Record<string, string> = {
  applied:         'Applied',
  shortlisted:     'Shortlisted',
  not_shortlisted: 'Not Shortlisted',
  rejected:        'Rejected',
  hired:           'Hired',
}
const STATUS_BADGE: Record<string, string> = {
  applied:         'bg-blue-100 text-blue-700',
  shortlisted:     'bg-amber-100 text-amber-700',
  not_shortlisted: 'bg-zinc-100 text-zinc-600',
  rejected:        'bg-red-100 text-red-700',
  hired:           'bg-emerald-100 text-emerald-700',
}
const STATUS_SORT_ORDER: Record<string, number> = {
  applied: 0, shortlisted: 1, hired: 2, not_shortlisted: 3, rejected: 4,
}

type PendingChange = { id: string; newStatus: 'not_shortlisted' | 'rejected' } | null

const col = createColumnHelper<ApplicationWithLearner>()

interface Props {
  applications: ApplicationWithLearner[]
}

export default function ApplicationsList({ applications }: Props) {
  const [sorting, setSorting]           = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(loadSizing)
  const [statusMap, setStatusMap]       = useState<Record<string, string>>(() =>
    Object.fromEntries(applications.map((a) => [a.id, a.status]))
  )
  const [pendingChange, setPendingChange] = useState<PendingChange>(null)
  const [noteText, setNoteText]           = useState('')
  const [noteError, setNoteError]         = useState(false)
  const [, startTransition] = useTransition()

  function handleStatusChange(id: string, newStatus: string) {
    if (newStatus === 'not_shortlisted' || newStatus === 'rejected') {
      setPendingChange({ id, newStatus })
      setNoteText('')
      setNoteError(false)
      return
    }
    setStatusMap((prev) => ({ ...prev, [id]: newStatus }))
    startTransition(() => updateApplicationStatus(id, newStatus))
  }

  function handleModalConfirm() {
    if (!noteText.trim()) { setNoteError(true); return }
    const { id, newStatus } = pendingChange!
    setStatusMap((prev) => ({ ...prev, [id]: newStatus }))
    startTransition(() => updateApplicationStatus(id, newStatus, noteText.trim()))
    setPendingChange(null)
    setNoteText('')
    setNoteError(false)
  }

  function handleModalCancel() {
    setPendingChange(null)
    setNoteText('')
    setNoteError(false)
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
          <p className="font-medium text-zinc-900">{info.getValue()}</p>
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
          pendingChange?.id === id
            ? pendingChange.newStatus
            : (statusMap[id] ?? info.getValue())
        const note =
          currentStatus === 'not_shortlisted'
            ? info.row.original.not_shortlisted_reason
            : currentStatus === 'rejected'
              ? info.row.original.rejection_feedback
              : null
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
            {note && (
              <p className="mt-1 max-w-[140px] truncate text-xs text-zinc-400" title={note}>
                {note}
              </p>
            )}
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
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {applications.length} application{applications.length !== 1 ? 's' : ''}
          {selectedCount > 0 && ` · ${selectedCount} selected`}
        </p>
        <ExportButton applications={selectedApplications} disabled={selectedCount === 0} />
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
            </h3>
            <p className="mb-4 text-sm text-zinc-500">
              {pendingChange.newStatus === 'not_shortlisted'
                ? 'Why wasn\'t this candidate shortlisted?'
                : 'What feedback did the company provide?'}
            </p>

            <textarea
              value={noteText}
              onChange={(e) => { setNoteText(e.target.value); setNoteError(false) }}
              rows={3}
              placeholder={
                pendingChange.newStatus === 'not_shortlisted'
                  ? 'e.g. Stronger candidates were selected for this round'
                  : 'e.g. Good communication but needs more technical depth'
              }
              className={`w-full resize-none rounded-lg border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900 ${
                noteError ? 'border-red-300 bg-red-50' : 'border-zinc-200'
              }`}
            />
            {noteError && (
              <p className="mt-1 text-xs text-red-600">This field is required.</p>
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
    </div>
  )
}
