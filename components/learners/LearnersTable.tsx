'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  type SortingState,
  type ColumnSizingState,
  type ColumnFiltersState,
  type Column,
  type FilterFn,
} from '@tanstack/react-table'

type ColumnVisibilityState = Record<string, boolean>

const SIZING_KEY     = 'hva-col-learners'
const VISIBILITY_KEY = 'hva-col-visibility-learners'

function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

const DEFAULT_VISIBILITY: ColumnVisibilityState = {
  phone_number:           false,
  cohort_fy:              false,
  placed_fy:              false,
  sub_cohort:             false,
  tech_mentor_name:       false,
  core_skills_mentor_name: false,
  new_lf:                 false,
  year_of_graduation:     false,
  degree:                 false,
  specialisation:         false,
  proactiveness:          false,
  articulation:           false,
  comprehension:          false,
}

function loadVisibility(): ColumnVisibilityState {
  if (typeof window === 'undefined') return DEFAULT_VISIBILITY
  try {
    const stored = localStorage.getItem(VISIBILITY_KEY)
    return stored ? { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) } : DEFAULT_VISIBILITY
  } catch { return DEFAULT_VISIBILITY }
}

const STATUS_BADGE: Record<string, string> = {
  Ongoing:          'bg-emerald-100 text-emerald-700',
  'On Hold':        'bg-orange-100 text-orange-700',
  Dropout:          'bg-red-100 text-red-700',
  Discontinued:     'bg-zinc-200 text-zinc-600',
  'Placed - Self':  'bg-blue-100 text-blue-700',
  'Placed - HVA':   'bg-violet-100 text-violet-700',
}

const READINESS_BADGE: Record<string, string> = {
  'Ready':        'bg-emerald-100 text-emerald-700',
  'Almost Ready': 'bg-amber-100 text-amber-700',
  'Not Ready':    'bg-red-100 text-red-700',
}

type LearnerRow = {
  learner_id:              string
  name:                    string
  email:                   string
  phone_number:            string | null
  batch_name:              string
  status:                  string
  lf_name:                 string
  new_lf:                  string | null
  track:                   string
  join_date:               string | null
  cohort_fy:               string | null
  placed_fy:               string | null
  sub_cohort:              string | null
  tech_mentor_name:        string | null
  core_skills_mentor_name: string | null
  year_of_graduation:      number | null
  degree:                  string | null
  specialisation:          string | null
  current_location:        string | null
  prs:                     number | null
  readiness:               string | null
  blacklisted_date:        string | null
  proactiveness:           number | null
  articulation:            number | null
  comprehension:           number | null
  tech_score:              number | null
}

// ── Multi-select filter ───────────────────────────────────────────────────────
const multiSelectFilter: FilterFn<LearnerRow> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

function FilterDropdown({ column }: { column: Column<LearnerRow, unknown> }) {
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

  const options = Array.from(column.getFacetedUniqueValues().keys())
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
              <span>{opt}</span>
            </label>
          ))}
          {options.length === 0 && <p className="px-3 py-1 text-xs text-zinc-400">No values</p>}
        </div>
      )}
    </div>
  )
}

const Chevron = () => (
  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
    </svg>
  </div>
)

const selectCls = 'appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-9 text-sm text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'

const col = createColumnHelper<LearnerRow>()

// Column metadata for the visibility toggle menu
const TOGGLEABLE_COLUMNS = [
  { id: 'phone_number',            label: 'Phone'               },
  { id: 'cohort_fy',               label: 'Cohort FY'           },
  { id: 'placed_fy',               label: 'Placed FY'           },
  { id: 'sub_cohort',              label: 'Sub Cohort'          },
  { id: 'tech_mentor_name',        label: 'Tech Mentor'         },
  { id: 'core_skills_mentor_name', label: 'Core Skills Mentor'  },
  { id: 'new_lf',                  label: 'New LF'              },
  { id: 'prs',                     label: 'PRS'                 },
  { id: 'readiness',               label: 'Readiness'           },
  { id: 'current_location',        label: 'Location'            },
  { id: 'blacklisted_date',        label: 'Blacklisted Date'    },
  { id: 'tech_score',              label: 'Tech Score'          },
  { id: 'year_of_graduation',      label: 'Grad Year'           },
  { id: 'degree',                  label: 'Degree'              },
  { id: 'specialisation',          label: 'Specialisation'      },
  { id: 'proactiveness',           label: 'Proactiveness'       },
  { id: 'articulation',            label: 'Articulation'        },
  { id: 'comprehension',           label: 'Comprehension'       },
]

const columns = [
  col.accessor('learner_id', {
    header: 'ID',
    size: 90,
    cell: (info) => <span className="font-mono text-xs text-zinc-400">{info.getValue()}</span>,
  }),
  col.accessor('name', {
    header: 'Name',
    size: 200,
    cell: (info) => (
      <Link
        href={`/learners?tab=snapshot&learner=${info.row.original.learner_id}`}
        className="font-medium text-zinc-900 hover:text-[#5BAE5B] hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor('email', {
    header: 'Email',
    size: 240,
    cell: (info) => <span className="text-zinc-400">{info.getValue()}</span>,
  }),
  col.accessor('batch_name', {
    header: 'Batch',
    size: 140,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('status', {
    header: 'Status',
    size: 130,
    filterFn: multiSelectFilter,
    cell: (info) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[info.getValue()] ?? 'bg-zinc-100 text-zinc-600'}`}>
        {info.getValue()}
      </span>
    ),
  }),
  col.accessor('lf_name', {
    header: 'LF',
    size: 160,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('new_lf', {
    header: 'New LF',
    size: 160,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('track', {
    header: 'Track',
    size: 140,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('join_date', {
    header: 'Joined',
    size: 110,
    cell: (info) => <span className="text-zinc-400">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('cohort_fy', {
    header: 'Cohort FY',
    size: 110,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('placed_fy', {
    header: 'Placed FY',
    size: 110,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('sub_cohort', {
    header: 'Sub Cohort',
    size: 110,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('phone_number', {
    header: 'Phone',
    size: 140,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('tech_mentor_name', {
    header: 'Tech Mentor',
    size: 160,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('core_skills_mentor_name', {
    header: 'Core Skills Mentor',
    size: 180,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('prs', {
    header: 'PRS',
    size: 80,
    cell: (info) => <span className="tabular-nums text-zinc-700">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('readiness', {
    header: 'Readiness',
    size: 130,
    filterFn: multiSelectFilter,
    cell: (info) => {
      const val = info.getValue()
      if (!val) return <span className="text-zinc-400">—</span>
      return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${READINESS_BADGE[val] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {val}
        </span>
      )
    },
  }),
  col.accessor('current_location', {
    header: 'Location',
    size: 150,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('blacklisted_date', {
    header: 'Blacklisted',
    size: 120,
    cell: (info) => {
      const val = info.getValue()
      if (!val) return <span className="text-zinc-400">—</span>
      return <span className="text-red-600 tabular-nums">{new Date(val).toLocaleDateString('en-GB')}</span>
    },
  }),
  col.accessor('tech_score', {
    header: 'Tech Score',
    size: 100,
    cell: (info) => <span className="tabular-nums text-zinc-700">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('year_of_graduation', {
    header: 'Grad Year',
    size: 100,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="tabular-nums text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('degree', {
    header: 'Degree',
    size: 150,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('specialisation', {
    header: 'Specialisation',
    size: 160,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('proactiveness', {
    header: 'Proactiveness',
    size: 120,
    cell: (info) => <span className="tabular-nums text-zinc-700">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('articulation', {
    header: 'Articulation',
    size: 110,
    cell: (info) => <span className="tabular-nums text-zinc-700">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('comprehension', {
    header: 'Comprehension',
    size: 130,
    cell: (info) => <span className="tabular-nums text-zinc-700">{info.getValue() ?? '—'}</span>,
  }),
]

interface LearnersTableProps {
  learners:  LearnerRow[]
  cohorts?:  string[]
  isLF?:     boolean
  viewAll?:  boolean
}

export default function LearnersTable({ learners, cohorts = [], isLF = false, viewAll = false }: LearnersTableProps) {
  const router         = useRouter()
  const searchParams   = useSearchParams()
  const activeCohort   = searchParams.get('fy') ?? ''

  const [sorting, setSorting]               = useState<SortingState>([])
  const [columnSizing, setColumnSizing]     = useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(DEFAULT_VISIBILITY)
  const [columnFilters, setColumnFilters]   = useState<ColumnFiltersState>([])
  const [showColMenu, setShowColMenu]       = useState(false)
  const colMenuRef                          = useRef<HTMLDivElement>(null)

  // Load persisted sizing + visibility from localStorage after hydration
  useEffect(() => {
    setColumnSizing(loadSizing())
    setColumnVisibility(loadVisibility())
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function updateCohort(val: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (val) params.set('fy', val)
    else params.delete('fy')
    router.push(`/learners?${params.toString()}`)
  }

  function toggleViewAll() {
    const params = new URLSearchParams(searchParams.toString())
    if (viewAll) params.delete('viewAll')
    else params.set('viewAll', '1')
    params.delete('fy')
    router.push(`/learners?${params.toString()}`)
  }

  const table = useReactTable({
    data: learners,
    columns,
    state: { sorting, columnSizing, columnVisibility, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (updater) => {
      setColumnVisibility((old: ColumnVisibilityState) => {
        const next = typeof updater === 'function' ? updater(old) : updater
        localStorage.setItem(VISIBILITY_KEY, JSON.stringify(next))
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
  const rowCountText  = filteredCount === learners.length
    ? `${learners.length} learner${learners.length !== 1 ? 's' : ''}`
    : `${filteredCount} of ${learners.length} learners`

  return (
    <div>
      {/* Toolbar: filters left, row count + columns button right */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Left: FY filter + viewAll toggle + clear */}
        <div className="flex flex-wrap items-center gap-2">
          {cohorts.length > 0 && (
            <div className="relative">
              <select value={activeCohort} onChange={(e) => updateCohort(e.target.value)} className={selectCls}>
                <option value="">All Cohorts</option>
                {cohorts.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Chevron />
            </div>
          )}
          {isLF && (
            <button
              onClick={toggleViewAll}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm hover:border-zinc-300 hover:bg-zinc-50"
            >
              {viewAll ? 'My Learners' : 'View All'}
            </button>
          )}
          {activeCohort && (
            <button
              onClick={() => updateCohort('')}
              className="text-xs font-medium text-zinc-400 hover:text-zinc-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Right: row count + download + columns toggle */}
        <div className="flex items-center gap-3" ref={colMenuRef}>
          <span className="text-sm text-zinc-500">{rowCountText}</span>

          <button
            onClick={() => exportToCsv(table, `learners_${new Date().toISOString().slice(0, 10)}.csv`)}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
            title="Download CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            CSV
          </button>

          <div className="relative">
            <button
              onClick={() => setShowColMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
                <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
              </svg>
              Columns
            </button>

            {showColMenu && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                {TOGGLEABLE_COLUMNS.map(({ id, label }) => {
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
    </div>
  )
}
