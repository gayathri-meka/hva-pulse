'use client'

import { useState, useRef, useEffect, useTransition, useMemo } from 'react'
import { updateAlumniRow } from '@/app/(protected)/alumni/actions'
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
  type ColumnDef,
} from '@tanstack/react-table'

type ColumnVisibilityState = Record<string, boolean>

const SIZING_KEY     = 'hva-col-alumni'
const VISIBILITY_KEY = 'hva-col-visibility-alumni'

function loadSizing(): ColumnSizingState {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(SIZING_KEY) ?? '{}') } catch { return {} }
}

export type AlumniTableRow = {
  id:                string
  name:              string
  email:             string | null
  cohort_fy:         string
  placed_fy:         string | null
  employment_status: string
  contact_number:    string | null
  company:           string | null
  role:              string | null
  salary:            number | null
  placement_month:   string | null
}

const DEFAULT_VISIBILITY: ColumnVisibilityState = {
  email:           false,
  placed_fy:       false,
  contact_number:  false,
  placement_month: false,
}

function loadVisibility(): ColumnVisibilityState {
  if (typeof window === 'undefined') return DEFAULT_VISIBILITY
  try {
    const stored = localStorage.getItem(VISIBILITY_KEY)
    return stored ? { ...DEFAULT_VISIBILITY, ...JSON.parse(stored) } : DEFAULT_VISIBILITY
  } catch { return DEFAULT_VISIBILITY }
}

// ── Multi-select filter ───────────────────────────────────────────────────────
const multiSelectFilter: FilterFn<AlumniTableRow> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

function FilterDropdown({ column }: { column: Column<AlumniTableRow, unknown> }) {
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

const col = createColumnHelper<AlumniTableRow>()

const TOGGLEABLE_COLUMNS = [
  { id: 'email',              label: 'Email'        },
  { id: 'cohort_fy',          label: 'Cohort FY'    },
  { id: 'placed_fy',         label: 'Placed FY'    },
  { id: 'employment_status',  label: 'Status'       },
  { id: 'company',            label: 'Company'      },
  { id: 'role',               label: 'Role'         },
  { id: 'salary',             label: 'Salary'       },
  { id: 'placement_month',    label: 'Placed Month' },
  { id: 'contact_number',     label: 'Contact'      },
]

const columns = [
  col.accessor('name', {
    header: 'Name',
    size: 200,
    cell: (info) => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
  }),
  col.accessor('email', {
    header: 'Email',
    size: 220,
    cell: (info) => <span className="text-zinc-400">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('cohort_fy', {
    header: 'Cohort FY',
    size: 110,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
  }),
  col.accessor('placed_fy', {
    header: 'Placed FY',
    size: 110,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('employment_status', {
    header: 'Status',
    size: 120,
    filterFn: multiSelectFilter,
    cell: (info) => {
      const val = info.getValue()
      if (val === 'employed') {
        return (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Employed
          </span>
        )
      }
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
          Unemployed
        </span>
      )
    },
  }),
  col.accessor('company', {
    header: 'Company',
    size: 180,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('role', {
    header: 'Role',
    size: 180,
    filterFn: multiSelectFilter,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
  col.accessor('salary', {
    header: 'Salary',
    size: 100,
    enableSorting: true,
    cell: (info) => {
      const val = info.getValue()
      return <span className="tabular-nums text-zinc-700">{val != null ? `${val} LPA` : '—'}</span>
    },
  }),
  col.accessor('placement_month', {
    header: 'Placed Month',
    size: 130,
    cell: (info) => {
      const val = info.getValue()
      if (!val) return <span className="text-zinc-400">—</span>
      const formatted = new Date(val + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
      return <span className="text-zinc-600">{formatted}</span>
    },
  }),
  col.accessor('contact_number', {
    header: 'Contact',
    size: 140,
    cell: (info) => <span className="text-zinc-600">{info.getValue() ?? '—'}</span>,
  }),
]

type EditForm = {
  employment_status: string
  placed_fy:         string
  company:           string
  role:              string
  salary:            string
}

export default function AlumniTable({ alumni }: { alumni: AlumniTableRow[] }) {
  const [sorting, setSorting]               = useState<SortingState>([])
  const [columnSizing, setColumnSizing]     = useState<ColumnSizingState>(loadSizing)
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(loadVisibility)
  const [columnFilters, setColumnFilters]   = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter]     = useState('')
  const [showColMenu, setShowColMenu]       = useState(false)
  const colMenuRef                          = useRef<HTMLDivElement>(null)
  const [editingRow, setEditingRow]         = useState<AlumniTableRow | null>(null)
  const [editForm, setEditForm]             = useState<EditForm>({ employment_status: 'employed', placed_fy: '', company: '', role: '', salary: '' })
  const [, startTransition]                 = useTransition()

  function openEdit(row: AlumniTableRow) {
    setEditForm({
      employment_status: row.employment_status,
      placed_fy:         row.placed_fy ?? '',
      company:           row.company ?? '',
      role:              row.role ?? '',
      salary:            row.salary != null ? String(row.salary) : '',
    })
    setEditingRow(row)
  }

  function saveEdit() {
    if (!editingRow) return
    startTransition(() =>
      updateAlumniRow(editingRow.id, {
        employment_status: editForm.employment_status,
        placed_fy:         editForm.placed_fy.trim() || null,
        company:           editForm.company.trim() || null,
        role:              editForm.role.trim() || null,
        salary:            editForm.salary ? parseFloat(editForm.salary) : null,
      })
    )
    setEditingRow(null)
  }

  const editColumn = useMemo<ColumnDef<AlumniTableRow>>(() => ({
    id:              'edit',
    size:            52,
    enableResizing:  false,
    enableSorting:   false,
    header:          () => null,
    cell:            ({ row }) => {
      if (row.original.cohort_fy < '2025-26') return null
      return (
        <button
          onClick={() => openEdit(row.original)}
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          title="Edit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474ZM4.75 13.5a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5Z" />
          </svg>
        </button>
      )
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setShowColMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const allColumns = useMemo(() => [...columns, editColumn], [editColumn])

  const table = useReactTable({
    data: alumni,
    columns: allColumns,
    state: { sorting, columnSizing, columnVisibility, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
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
    getRowId: (row) => row.id,
  })

  const filteredCount = table.getFilteredRowModel().rows.length
  const rowCountText  = filteredCount === alumni.length
    ? `${alumni.length} alumni`
    : `${filteredCount} of ${alumni.length} alumni`

  return (
    <div>
      {/* Toolbar: search + row count left, columns button right */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <input
            type="search"
            placeholder="Search alumni..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-56 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 placeholder:text-zinc-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          />
          <span className="text-sm text-zinc-500">{rowCountText}</span>
        </div>

        <div className="relative" ref={colMenuRef}>
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
                      className={cell.column.id === 'edit' ? 'px-2 py-3.5' : 'px-6 py-3.5'}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {alumni.length === 0 && (
                <tr>
                  <td colSpan={allColumns.length} className="px-6 py-12 text-center text-sm text-zinc-400">
                    No alumni records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit modal (2025-26+ cohorts only) ───────────────────────────── */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingRow(null)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-zinc-900">Edit Alumni</h3>
            <p className="mb-4 text-sm text-zinc-500">{editingRow.name}</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-500">Status</label>
                <select
                  value={editForm.employment_status}
                  onChange={(e) => setEditForm((f) => ({ ...f, employment_status: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                >
                  <option value="employed">Employed</option>
                  <option value="unemployed">Unemployed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500">Company</label>
                <input
                  type="text"
                  value={editForm.company}
                  onChange={(e) => setEditForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="e.g. Accenture"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500">Role</label>
                <input
                  type="text"
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="e.g. Software Engineer"
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500">Salary (LPA)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editForm.salary}
                    onChange={(e) => setEditForm((f) => ({ ...f, salary: e.target.value }))}
                    placeholder="e.g. 8.5"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500">Placed FY</label>
                  <input
                    type="text"
                    value={editForm.placed_fy}
                    onChange={(e) => setEditForm((f) => ({ ...f, placed_fy: e.target.value }))}
                    placeholder="e.g. 2025-26"
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-inset focus:ring-zinc-900"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditingRow(null)}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
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
