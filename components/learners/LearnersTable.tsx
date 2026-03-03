'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnSizingState,
} from '@tanstack/react-table'

type ColumnVisibilityState = Record<string, boolean>

const SIZING_KEY     = 'hva-col-learners'
const VISIBILITY_KEY = 'hva-col-visibility-learners'

function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

const DEFAULT_VISIBILITY: ColumnVisibilityState = {
  year_of_graduation: false,
  degree:             false,
  specialisation:     false,
  proactiveness:      false,
  articulation:       false,
  comprehension:      false,
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
  learner_id:         string
  name:               string
  email:              string
  batch_name:         string
  status:             string
  lf_name:            string
  track:              string
  join_date:          string | null
  year_of_graduation: number | null
  degree:             string | null
  specialisation:     string | null
  current_location:   string | null
  prs:                number | null
  readiness:          string | null
  blacklisted_date:   string | null
  proactiveness:      number | null
  articulation:       number | null
  comprehension:      number | null
  tech_score:         number | null
}

const col = createColumnHelper<LearnerRow>()

// Column metadata for the visibility toggle menu
const TOGGLEABLE_COLUMNS = [
  { id: 'prs',                label: 'PRS'               },
  { id: 'readiness',          label: 'Readiness'         },
  { id: 'current_location',   label: 'Location'          },
  { id: 'blacklisted_date',   label: 'Blacklisted Date'  },
  { id: 'tech_score',         label: 'Tech Score'        },
  { id: 'year_of_graduation', label: 'Grad Year'         },
  { id: 'degree',             label: 'Degree'            },
  { id: 'specialisation',     label: 'Specialisation'    },
  { id: 'proactiveness',      label: 'Proactiveness'     },
  { id: 'articulation',       label: 'Articulation'      },
  { id: 'comprehension',      label: 'Comprehension'     },
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
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('status', {
    header: 'Status',
    size: 130,
    cell: (info) => (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[info.getValue()] ?? 'bg-zinc-100 text-zinc-600'}`}>
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
  col.accessor('prs', {
    header: 'PRS',
    size: 80,
    cell: (info) => <span className="tabular-nums text-zinc-700">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('readiness', {
    header: 'Readiness',
    size: 130,
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
    cell: (info) => <span className="tabular-nums text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('degree', {
    header: 'Degree',
    size: 150,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('specialisation', {
    header: 'Specialisation',
    size: 160,
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

export default function LearnersTable({ learners }: { learners: LearnerRow[] }) {
  const [sorting, setSorting]               = useState<SortingState>([])
  const [columnSizing, setColumnSizing]     = useState<ColumnSizingState>(loadSizing)
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(loadVisibility)
  const [showColMenu, setShowColMenu]       = useState(false)
  const colMenuRef                          = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const table = useReactTable({
    data: learners,
    columns,
    state: { sorting, columnSizing, columnVisibility },
    onSortingChange: setSorting,
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
    columnResizeMode: 'onChange',
    getRowId: (row) => row.learner_id,
  })

  return (
    <div>
      {/* Columns toggle */}
      <div className="mb-3 flex justify-end" ref={colMenuRef}>
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
    </div>
  )
}
