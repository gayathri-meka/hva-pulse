'use client'

import { useState, useMemo, useRef, useEffect, useTransition } from 'react'
import Link from 'next/link'
import ExpandableNote from '@/components/ui/ExpandableNote'
import { updateApplicationStatus } from '@/app/(protected)/placements/actions'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnSizingState,
  type ColumnFiltersState,
  type ColumnOrderState,
  type Column,
  type FilterFn,
  type VisibilityState,
} from '@tanstack/react-table'

export type MatchingStatus =
  | 'applied' | 'shortlisted' | 'interviews_ongoing' | 'on_hold' | 'not_shortlisted' | 'rejected' | 'hired'
  | 'not_applied' | 'not_interested'

export type AppDetail = {
  company:  string
  role:     string
  status:   string
  feedback: string | null
  reasons:  string[]
}

export type MatchingRow = {
  learner_id:              string
  name:                    string
  batch:                   string
  lf:                      string
  sub_cohort:              string | null
  learner_status:          string | null
  year_of_graduation:      number | null
  degree:                  string | null
  specialisation:          string | null
  readiness:               string | null
  prs_score:               number | null
  proactiveness:           number | null
  articulation:            number | null
  comprehension:           number | null
  tech_score:              number | null
  current_location:        string | null
  is_blacklisted:          'Yes' | 'No'
  blacklisted_date:        string | null
  new_lf:                  string | null
  new_batch:               string | null
  app_id:                  string | null
  status:                  MatchingStatus
  reasons:                 string[]
  not_shortlisted_reason:  string | null
  not_shortlisted_reasons: string[]
  rejection_feedback:      string | null
  rejection_reasons:       string[]
  // Cross-role aggregates
  applied_count:           number
  applied_details:         AppDetail[]
  not_interested_count:    number
  not_interested_details:  { company: string; role: string; reasons: string[] }[]
  not_shortlisted_count:   number
  not_shortlisted_details: AppDetail[]
  ongoing_count:           number
  ongoing_details:         AppDetail[]
  rejected_count:          number
  rejected_details:        AppDetail[]
  feedback_details:        AppDetail[]
}

// ── Status display ────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<MatchingStatus, string> = {
  applied:            'bg-blue-100 text-blue-700',
  shortlisted:        'bg-amber-100 text-amber-700',
  interviews_ongoing: 'bg-violet-100 text-violet-700',
  on_hold:            'bg-orange-100 text-orange-700',
  not_shortlisted:    'bg-zinc-100 text-zinc-600',
  rejected:           'bg-red-100 text-red-700',
  hired:              'bg-emerald-100 text-emerald-700',
  not_applied:        'bg-zinc-100 text-zinc-500',
  not_interested:     'bg-zinc-100 text-zinc-400',
}

const STATUS_LABEL: Record<MatchingStatus, string> = {
  applied:            'Applied',
  shortlisted:        'Shortlisted',
  interviews_ongoing: 'Interviews Ongoing',
  on_hold:            'On Hold',
  not_shortlisted:    'Not Shortlisted',
  rejected:           'Rejected',
  hired:              'Hired',
  not_applied:        'Not Applied',
  not_interested:     'Not Interested',
}

// Application statuses available in the dropdown (excludes non-application statuses)
const APP_STATUS_OPTIONS = [
  'applied', 'shortlisted', 'interviews_ongoing', 'on_hold', 'not_shortlisted', 'rejected', 'hired',
] as const

const DEFAULT_NS_REASONS = [
  'Skill Mismatch', 'Eligibility Mismatch', 'Location Mismatch',
  'Blacklisted', 'Joining Date Mismatch', 'Other',
]
const DEFAULT_REJECTION_REASONS = [
  'Gap in technical skills', 'Gap in communication skills', 'Copied', 'Other',
]

type PendingChange = { id: string; newStatus: 'not_shortlisted' | 'rejected' } | null

// ── Shared multi-select filterFn ──────────────────────────────────────────────
const multiSelectFilter: FilterFn<MatchingRow> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

function numCell(val: number | null) {
  return <span className="tabular-nums text-zinc-500">{val != null ? val : '—'}</span>
}

// ── Multi-select checkbox dropdown ────────────────────────────────────────────
function FilterDropdown({ column }: { column: Column<MatchingRow, unknown> }) {
  const [open, setOpen] = useState(false)
  const containerRef    = useRef<HTMLDivElement>(null)
  const selected        = (column.getFilterValue() as string[]) ?? []

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const options: string[] =
    column.id === 'is_blacklisted'
      ? ['Yes', 'No']
      : Array.from(column.getFacetedUniqueValues().keys())
          .filter((v) => v != null && v !== '')
          .map(String)
          .sort()

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
        onClick={() => setOpen((o) => !o)}
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
        <div className="absolute left-0 top-full z-20 mt-0.5 max-h-52 min-w-[140px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => { column.setFilterValue(undefined); setOpen(false) }}
              className="w-full px-3 py-1 text-left text-xs text-blue-500 hover:bg-zinc-50 border-b border-zinc-100"
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
              <span>{opt}</span>
            </label>
          ))}
          {options.length === 0 && <p className="px-3 py-1 text-xs text-zinc-400">No values</p>}
        </div>
      )}
    </div>
  )
}

// ── Column ordering ───────────────────────────────────────────────────────────
const VISIBILITY_KEY = 'hva-col-matching-visibility'

const HIDEABLE_COLS = [
  { id: 'batch',              label: 'Batch' },
  { id: 'lf',                 label: 'LF' },
  { id: 'new_lf',             label: 'New LF' },
  { id: 'new_batch',          label: 'New Batch' },
  { id: 'sub_cohort',         label: 'Sub Cohort' },
  { id: 'learner_status',     label: 'Program Status' },
  { id: 'applied_count',      label: 'Applied' },
  { id: 'not_interested_count', label: 'Not Interested' },
  { id: 'not_shortlisted_count', label: 'Not Shortlisted' },
  { id: 'ongoing_count',      label: 'Ongoing Interviews' },
  { id: 'rejected_count',     label: 'Rejected' },
  { id: 'year_of_graduation', label: 'Grad Year' },
  { id: 'degree',             label: 'Degree' },
  { id: 'specialisation',     label: 'Specialisation' },
  { id: 'readiness',          label: 'Readiness' },
  { id: 'prs_score',          label: 'PRS' },
  { id: 'proactiveness',      label: 'Proactiveness' },
  { id: 'articulation',       label: 'Articulation' },
  { id: 'comprehension',      label: 'Comprehension' },
  { id: 'tech_score',         label: 'Tech Score' },
  { id: 'current_location',   label: 'Location' },
  { id: 'is_blacklisted',     label: 'Blacklisted' },
]

const BASE_ORDER: ColumnOrderState = [
  'name', 'batch', 'lf', 'new_lf', 'new_batch', 'sub_cohort', 'learner_status',
  'applied_count', 'not_interested_count', 'not_shortlisted_count', 'ongoing_count', 'rejected_count',
  'year_of_graduation', 'degree', 'specialisation', 'readiness',
  'prs_score', 'proactiveness', 'articulation', 'comprehension', 'tech_score',
  'current_location', 'is_blacklisted', 'status',
]
const ROLE_ORDER: ColumnOrderState = [
  'name', 'status', 'batch', 'lf', 'new_lf',
  'applied_count', 'not_interested_count', 'not_shortlisted_count', 'ongoing_count', 'rejected_count',
  'year_of_graduation', 'degree', 'specialisation', 'readiness',
  'prs_score', 'proactiveness', 'articulation', 'comprehension', 'tech_score',
  'current_location', 'is_blacklisted',
]

// ── Sizing ────────────────────────────────────────────────────────────────────
const SIZING_KEY = 'hva-col-matching'
function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

// ── Table component ───────────────────────────────────────────────────────────
export default function MatchingTable({ rows, roleSelected = true, subCohortOptions = [], nsReasons, rejectionReasons }: {
  rows: MatchingRow[]
  roleSelected?: boolean
  subCohortOptions?: string[]
  nsReasons?: string[]
  rejectionReasons?: string[]
}) {
  const NS_REASONS = nsReasons ?? DEFAULT_NS_REASONS
  const REJECTION_REASONS = rejectionReasons ?? DEFAULT_REJECTION_REASONS
  const [sorting, setSorting]                   = useState<SortingState>([{ id: 'prs_score', desc: true }])
  const [columnSizing, setColumnSizing]         = useState<ColumnSizingState>(loadSizing)
  const [columnFilters, setColumnFilters]       = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [showColMenu, setShowColMenu]           = useState(false)
  const colMenuRef                              = useRef<HTMLDivElement>(null)

  // Hydrate column visibility from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(VISIBILITY_KEY)
      if (stored) setColumnVisibility(JSON.parse(stored))
    } catch {}
  }, [])

  // Click-outside for column menu
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const [detailPopup, setDetailPopup] = useState<{ title: string; rows: AppDetail[] } | null>(null)
  const [niPopup, setNiPopup]         = useState<{ title: string; rows: { company: string; role: string; reasons: string[] }[] } | null>(null)

  const [statusMap, setStatusMap]         = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.filter((r) => r.app_id).map((r) => [r.app_id!, r.status]))
  )
  const [pendingChange, setPendingChange]   = useState<PendingChange>(null)
  const [noteText, setNoteText]             = useState('')
  const [checkedReasons, setCheckedReasons] = useState<Set<string>>(new Set())
  const [reasonsError, setReasonsError]     = useState(false)
  const [, startTransition] = useTransition()

  function handleStatusChange(appId: string, newStatus: string) {
    if (newStatus === 'not_shortlisted' || newStatus === 'rejected') {
      setPendingChange({ id: appId, newStatus })
      setNoteText('')
      setCheckedReasons(new Set())
      setReasonsError(false)
      return
    }
    setStatusMap((prev) => ({ ...prev, [appId]: newStatus }))
    startTransition(() => updateApplicationStatus(appId, newStatus))
  }

  function handleModalConfirm() {
    if (!pendingChange) return
    if (checkedReasons.size === 0) { setReasonsError(true); return }
    const reasons = Array.from(checkedReasons)
    const note    = noteText.trim() || undefined
    setStatusMap((prev) => ({ ...prev, [pendingChange.id]: pendingChange.newStatus }))
    startTransition(() => updateApplicationStatus(pendingChange.id, pendingChange.newStatus, note, reasons))
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

  const col = createColumnHelper<MatchingRow>()

  const columns = useMemo(() => [
    col.accessor('name', {
      header: 'Learner',
      size: 200,
      enableColumnFilter: false,
      cell: (info) => (
        <Link
          href={`/learners?tab=snapshot&learner=${info.row.original.learner_id}`}
          className="font-medium text-zinc-900 hover:text-[#5BAE5B] hover:underline"
        >
          {info.getValue()}
        </Link>
      ),
    }),
    col.accessor('batch', {
      header: 'Batch',
      size: 140,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('lf', {
      header: 'LF',
      size: 140,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('new_lf', {
      header: 'New LF',
      size: 140,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('new_batch', {
      header: 'New Batch',
      size: 140,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('sub_cohort', {
      header: 'Sub Cohort',
      size: 110,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('learner_status', {
      header: 'Program Status',
      size: 130,
      filterFn: multiSelectFilter,
      cell: (info) => {
        const val = info.getValue()
        if (!val) return <span className="text-zinc-300">—</span>
        const badge: Record<string, string> = {
          Ongoing:          'bg-emerald-100 text-emerald-700',
          'On Hold':        'bg-orange-100 text-orange-700',
          Dropout:          'bg-red-100 text-red-700',
          Discontinued:     'bg-zinc-200 text-zinc-600',
          'Placed - Self':  'bg-blue-100 text-blue-700',
          'Placed - HVA':   'bg-violet-100 text-violet-700',
        }
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[val] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {val}
          </span>
        )
      },
    }),
    col.accessor('year_of_graduation', {
      header: 'Grad Year',
      size: 110,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="tabular-nums text-zinc-500">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('degree', {
      header: 'Degree',
      size: 140,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('specialisation', {
      header: 'Specialisation',
      size: 170,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('readiness', {
      header: 'Readiness',
      size: 130,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('prs_score', {
      header: 'PRS',
      size: 90,
      filterFn: multiSelectFilter,
      cell: (info) => numCell(info.getValue()),
    }),
    col.accessor('proactiveness', {
      header: 'Proactiveness',
      size: 130,
      filterFn: multiSelectFilter,
      cell: (info) => numCell(info.getValue()),
    }),
    col.accessor('articulation', {
      header: 'Articulation',
      size: 120,
      filterFn: multiSelectFilter,
      cell: (info) => numCell(info.getValue()),
    }),
    col.accessor('comprehension', {
      header: 'Comprehension',
      size: 130,
      filterFn: multiSelectFilter,
      cell: (info) => numCell(info.getValue()),
    }),
    col.accessor('tech_score', {
      header: 'Tech Score',
      size: 110,
      filterFn: multiSelectFilter,
      cell: (info) => numCell(info.getValue()),
    }),
    col.accessor('current_location', {
      header: 'Location',
      size: 140,
      filterFn: multiSelectFilter,
      cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('is_blacklisted', {
      header: 'Blacklisted?',
      size: 120,
      enableSorting: false,
      filterFn: multiSelectFilter,
      cell: (info) => {
        const v    = info.getValue() === 'Yes'
        const date = info.row.original.blacklisted_date
        return (
          <span className="relative group/bl inline-flex">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                v ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              {v ? 'Yes' : 'No'}
            </span>
            {v && date && (
              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover/bl:opacity-100 z-30">
                Blacklisted on {date}
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-800" />
              </span>
            )}
          </span>
        )
      },
    }),
    col.accessor('applied_count', {
      header: 'Applied',
      size: 80,
      cell: (info) => {
        const v = info.getValue()
        const details = info.row.original.applied_details
        return v > 0 ? (
          <button onClick={() => setDetailPopup({ title: `${info.row.original.name} — Applications (${v})`, rows: details })}
            className="font-medium text-blue-600 hover:underline tabular-nums">{v}</button>
        ) : <span className="text-zinc-300">0</span>
      },
    }),
    col.accessor('not_interested_count', {
      header: 'Not Interested',
      size: 110,
      cell: (info) => {
        const v = info.getValue()
        const details = info.row.original.not_interested_details
        return v > 0 ? (
          <button onClick={() => setNiPopup({ title: `${info.row.original.name} — Not Interested (${v})`, rows: details })}
            className="font-medium text-zinc-700 hover:underline tabular-nums">{v}</button>
        ) : <span className="text-zinc-300">0</span>
      },
    }),
    col.accessor('not_shortlisted_count', {
      header: 'Not Shortlisted',
      size: 120,
      cell: (info) => {
        const v = info.getValue()
        const details = info.row.original.not_shortlisted_details
        return v > 0 ? (
          <button onClick={() => setDetailPopup({ title: `${info.row.original.name} — Not Shortlisted (${v})`, rows: details })}
            className="font-medium text-red-600 hover:underline tabular-nums">{v}</button>
        ) : <span className="text-zinc-300">0</span>
      },
    }),
    col.accessor('ongoing_count', {
      header: 'Ongoing',
      size: 80,
      cell: (info) => {
        const v = info.getValue()
        const details = info.row.original.ongoing_details
        return v > 0 ? (
          <button onClick={() => setDetailPopup({ title: `${info.row.original.name} — Ongoing Interviews (${v})`, rows: details })}
            className="font-medium text-violet-600 hover:underline tabular-nums">{v}</button>
        ) : <span className="text-zinc-300">0</span>
      },
    }),
    col.accessor('rejected_count', {
      header: 'Rejected',
      size: 80,
      cell: (info) => {
        const v = info.getValue()
        const details = info.row.original.rejected_details
        return v > 0 ? (
          <button onClick={() => setDetailPopup({ title: `${info.row.original.name} — Rejected (${v})`, rows: details })}
            className="font-medium text-red-600 hover:underline tabular-nums">{v}</button>
        ) : <span className="text-zinc-300">0</span>
      },
    }),
    col.accessor('status', {
      header: 'Status',
      size: 180,
      enableColumnFilter: false,
      cell: (info) => {
        const row    = info.row.original
        const appId  = row.app_id
        const currentStatus = appId
          ? ((statusMap[appId] ?? row.status) as MatchingStatus)
          : row.status

        const note = (() => {
          if (currentStatus === 'not_shortlisted') {
            const reasons = row.not_shortlisted_reasons
            const comment = row.not_shortlisted_reason
            if (reasons.length > 0) return reasons.join(', ') + (comment ? ` — ${comment}` : '')
            return comment
          }
          if (currentStatus === 'rejected') {
            const reasons = row.rejection_reasons
            const comment = row.rejection_feedback
            if (reasons.length > 0) return reasons.join(', ') + (comment ? ` — ${comment}` : '')
            return comment
          }
          if (currentStatus === 'not_interested') {
            return row.reasons.length > 0 ? row.reasons.join(', ') : null
          }
          return null
        })()

        // No application — show badge only
        if (!appId) {
          return (
            <div>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[currentStatus]}`}>
                {STATUS_LABEL[currentStatus]}
              </span>
              {note && <ExpandableNote note={note} />}
            </div>
          )
        }

        // Has application — show editable dropdown
        return (
          <div>
            <div className="relative inline-flex">
              <select
                value={currentStatus}
                onChange={(e) => handleStatusChange(appId, e.target.value)}
                className={`appearance-none cursor-pointer rounded-full border-0 pl-2.5 pr-6 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 ${
                  STATUS_BADGE[currentStatus] ?? 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {APP_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [statusMap])

  const columnOrder = useMemo<ColumnOrderState>(
    () => (roleSelected ? ROLE_ORDER : BASE_ORDER),
    [roleSelected],
  )

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnSizing, columnFilters, columnOrder, columnVisibility: { ...columnVisibility, status: roleSelected } },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((old) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        try { localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    },
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
    getRowId: (row) => row.learner_id,
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const rowCountText  =
    filteredCount === rows.length
      ? `${rows.length} learner${rows.length !== 1 ? 's' : ''}`
      : `${filteredCount} of ${rows.length} learners`

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-3" ref={colMenuRef}>
        <span className="text-sm text-zinc-500">{rowCountText}</span>
        <div className="relative">
          <button
            onClick={() => setShowColMenu((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
            </svg>
            Columns
          </button>

          {showColMenu && (
            <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
              {HIDEABLE_COLS.map(({ id, label }) => {
                const column = table.getColumn(id)
                if (!column) return null
                return (
                  <label key={id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-zinc-50">
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                    />
                    <span className="text-xs text-zinc-700">{label}</span>
                  </label>
                )
              })}
            </div>
          )}
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
                    className="relative select-none px-4 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                  >
                    <div
                      className={header.column.getCanSort() ? 'flex cursor-pointer items-center gap-1' : ''}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'  && <span>↑</span>}
                      {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                    </div>
                    {header.column.getCanFilter() && <FilterDropdown column={header.column} />}
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
                      className="px-4 py-3"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
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

      {/* Reasons modal */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={handleModalCancel} />
          <div className="relative w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-zinc-900">
              {pendingChange.newStatus === 'not_shortlisted' ? 'Not Shortlisted' : 'Rejected'}
            </h3>
            <p className="mb-4 text-sm text-zinc-500">
              {pendingChange.newStatus === 'not_shortlisted'
                ? "Why wasn't this candidate shortlisted?"
                : 'Why was this candidate rejected?'}
            </p>
            {(() => {
              const reasons     = pendingChange.newStatus === 'not_shortlisted' ? NS_REASONS : REJECTION_REASONS
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

      {/* Application detail popup */}
      {detailPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">{detailPopup.title}</h2>
              <button onClick={() => setDetailPopup(null)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 70px)' }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Company</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Role</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Feedback / Reasons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {detailPopup.rows.map((d, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-900">{d.company}</td>
                      <td className="px-3 py-2 text-zinc-600">{d.role}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[d.status as MatchingStatus] ?? 'bg-zinc-100 text-zinc-600'}`}>
                          {STATUS_LABEL[d.status as MatchingStatus] ?? d.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {d.reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-0.5">
                            {d.reasons.map((r, j) => (
                              <span key={j} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{r}</span>
                            ))}
                          </div>
                        )}
                        {d.feedback && <p className="text-zinc-500">{d.feedback}</p>}
                        {!d.feedback && d.reasons.length === 0 && <span className="text-zinc-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Not interested detail popup */}
      {niPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">{niPopup.title}</h2>
              <button onClick={() => setNiPopup(null)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(90vh - 70px)' }}>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-left">
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Company</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Role</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Reasons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {niPopup.rows.map((d, i) => (
                    <tr key={i} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 font-medium text-zinc-900">{d.company}</td>
                      <td className="px-3 py-2 text-zinc-600">{d.role}</td>
                      <td className="px-3 py-2">
                        {d.reasons.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {d.reasons.map((r, j) => (
                              <span key={j} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{r}</span>
                            ))}
                          </div>
                        ) : <span className="text-xs text-zinc-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
