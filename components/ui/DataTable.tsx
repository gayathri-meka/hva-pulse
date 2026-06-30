'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { exportToCsv } from '@/lib/exportToCsv'
import { multiSelectFilter, rowMatchesSearch } from '@/lib/tableFilters'
import ColumnFilterDropdown from './ColumnFilterDropdown'

// ── Shared, standardised data table ─────────────────────────────────────────
// Every Pulse table should use this so they all look and behave identically:
// sticky header, sortable, per-column filters (with search-within), column
// show/hide menu, persisted sizing + visibility, CSV export, and — crucially —
// pinning that turns OFF on mobile so frozen columns don't make tables unreadable.

/** Passed to toolbar slots so actions (e.g. email) can target the right rows. */
export type ToolbarCtx<T> = { selectedRows: T[]; filteredRows: T[]; clearSelection: () => void }
type Slot<T> = React.ReactNode | ((ctx: ToolbarCtx<T>) => React.ReactNode)

export type DataTableProps<T> = {
  data: T[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]
  /** Unique namespace for persisting column sizing + visibility to localStorage. */
  storageKey: string
  /** Adds a checkbox column for picking rows; toolbar slots receive the selection. */
  enableRowSelection?: boolean
  getRowId?: (row: T, index: number) => string
  /** Columns pinned to the left ON DESKTOP ONLY (auto-unpinned on mobile). */
  pinnedLeft?: string[]
  initialSorting?: SortingState
  /** Enables the search box; rows match if any of these fields contains the query. */
  searchKeys?: (keyof T | string)[]
  searchPlaceholder?: string
  /** Enables the CSV button with this filename prefix. */
  csvFilename?: string
  enableColumnVisibility?: boolean
  /** Extra toolbar controls (left = after search, right = before CSV). May be a
   *  render function receiving { selectedRows, filteredRows, clearSelection }. */
  toolbarLeft?: Slot<T>
  toolbarRight?: Slot<T>
  emptyMessage?: string
  rowClassName?: (row: T) => string
}

function useIsDesktop(): boolean {
  // Start false so SSR and first client render agree (no pinning), then enable
  // pinning after mount on wide viewports.
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return desktop
}

const lsGet = (k: string) => {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(k) ?? '{}') } catch { return {} }
}

export default function DataTable<T>({
  data,
  columns,
  storageKey,
  enableRowSelection = false,
  getRowId,
  pinnedLeft = [],
  initialSorting = [],
  searchKeys,
  searchPlaceholder = 'Search…',
  csvFilename,
  enableColumnVisibility = true,
  toolbarLeft,
  toolbarRight,
  emptyMessage = 'No rows.',
  rowClassName,
}: DataTableProps<T>) {
  const SIZING_KEY = `dt:${storageKey}:sizing`
  const VIS_KEY = `dt:${storageKey}:visibility`

  const isDesktop = useIsDesktop()
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [search, setSearch] = useState('')
  const [showColMenu, setShowColMenu] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)

  // Prepend a checkbox column when selection is enabled.
  const allColumns = useMemo<typeof columns>(() => {
    if (!enableRowSelection) return columns
    const selectCol: ColumnDef<T> = {
      id: '__select',
      size: 40,
      enableSorting: false,
      enableResizing: false,
      enableHiding: false,
      enableColumnFilter: false,
      header: ({ table }) => (
        <CheckboxCell
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <CheckboxCell checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
      ),
    }
    return [selectCol, ...columns]
  }, [columns, enableRowSelection])

  // Restore persisted sizing/visibility after mount (avoids hydration mismatch).
  useEffect(() => {
    const s = lsGet(SIZING_KEY)
    if (Object.keys(s).length) setColumnSizing(s)
    const v = lsGet(VIS_KEY)
    if (Object.keys(v).length) setColumnVisibility(v)
  }, [SIZING_KEY, VIS_KEY])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const filtered = useMemo(() => {
    if (!searchKeys?.length || !search.trim()) return data
    return data.filter((r) => rowMatchesSearch(r, searchKeys, search))
  }, [data, search, searchKeys])

  const table = useReactTable({
    data: filtered,
    columns: allColumns,
    defaultColumn: { filterFn: multiSelectFilter, minSize: 60 },
    enableRowSelection,
    state: {
      sorting,
      columnFilters,
      columnSizing,
      columnVisibility,
      rowSelection,
      columnPinning: {
        left: [
          ...(enableRowSelection && isDesktop ? ['__select'] : []),
          ...(isDesktop ? pinnedLeft : []),
        ],
      },
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: (u) => {
      setColumnVisibility((old) => {
        const next = typeof u === 'function' ? u(old) : u
        try { localStorage.setItem(VIS_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    },
    onColumnSizingChange: (u) => {
      setColumnSizing((old) => {
        const next = typeof u === 'function' ? u(old) : u
        try { localStorage.setItem(SIZING_KEY, JSON.stringify(next)) } catch {}
        return next
      })
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    columnResizeMode: 'onChange',
    ...(getRowId ? { getRowId } : {}),
  })

  const total = data.length
  const visible = table.getRowModel().rows.length
  const countLabel = visible === total ? `${total} row${total === 1 ? '' : 's'}` : `${visible} of ${total}`
  const hideable = table.getAllLeafColumns().filter((c) => c.getCanHide())

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
  const filteredRows = table.getFilteredRowModel().rows.map((r) => r.original)
  const ctx: ToolbarCtx<T> = { selectedRows, filteredRows, clearSelection: () => table.resetRowSelection() }
  const renderSlot = (slot?: Slot<T>) => (typeof slot === 'function' ? slot(ctx) : slot)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {/* Left: search + count + extra controls */}
        <div className="flex flex-wrap items-center gap-2">
          {searchKeys?.length ? (
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-56 rounded-lg border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
              />
            </div>
          ) : null}
          <span className="whitespace-nowrap text-xs font-medium text-zinc-500">{countLabel}</span>
          {selectedRows.length > 0 && (
            <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#E1F5EE] px-2 py-0.5 text-xs font-medium text-[#085041]">
              {selectedRows.length} selected
              <button onClick={() => table.resetRowSelection()} className="text-[#085041]/60 hover:text-[#085041]" title="Clear selection">✕</button>
            </span>
          )}
          {renderSlot(toolbarLeft)}
          {columnFilters.length > 0 && (
            <button onClick={() => setColumnFilters([])} className="text-xs font-medium text-blue-500 hover:text-blue-700">
              Clear filters
            </button>
          )}
        </div>

        {/* Right: extra controls + CSV + columns menu */}
        <div className="flex items-center gap-2" ref={colMenuRef}>
          {renderSlot(toolbarRight)}
          {csvFilename && (
            <button
              onClick={() => exportToCsv(table, `${csvFilename}_${new Date().toISOString().slice(0, 10)}.csv`)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
              title="Download CSV"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
                <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
                <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
              </svg>
              CSV
            </button>
          )}
          {enableColumnVisibility && hideable.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowColMenu((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
                  <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                  <path fillRule="evenodd" d="M.664 10.59a1.65 1.65 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                </svg>
                Columns
              </button>
              {showColMenu && (
                <div className="absolute right-0 z-50 mt-1 max-h-72 w-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                  {hideable.map((col) => (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                        className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                      />
                      <span className="truncate">
                        {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
          <p className="text-sm text-zinc-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            <table className="border-separate text-sm" style={{ tableLayout: 'fixed', width: table.getTotalSize(), borderSpacing: 0 }}>
              <thead>
                <tr className="bg-zinc-50 text-left">
                  {table.getFlatHeaders().map((header) => {
                    const pinned = header.column.getIsPinned() === 'left'
                    const isLastPinned = pinned && header.column.getIsLastColumn('left')
                    const left = pinned ? header.column.getStart('left') : undefined
                    const isSelect = header.column.id === '__select'
                    return (
                      <th
                        key={header.id}
                        style={{ width: header.getSize(), left }}
                        className={`sticky top-0 select-none border-b border-zinc-200 bg-zinc-50 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 ${isSelect ? 'px-3 text-center' : 'px-6'} ${pinned ? 'z-20' : 'z-10'} ${isLastPinned ? 'border-r border-zinc-200' : ''}`}
                      >
                        {isSelect ? (
                          flexRender(header.column.columnDef.header, header.getContext())
                        ) : (
                        <div className="flex flex-col gap-1">
                          <div
                            className={`flex items-center gap-1 ${header.column.getCanSort() ? 'cursor-pointer' : ''}`}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span className="truncate">{flexRender(header.column.columnDef.header, header.getContext())}</span>
                            {header.column.getIsSorted() === 'asc' && <span>↑</span>}
                            {header.column.getIsSorted() === 'desc' && <span>↓</span>}
                          </div>
                          {header.column.getCanFilter() && <ColumnFilterDropdown column={header.column} />}
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
                  <tr key={row.id} className={`group hover:bg-zinc-50 ${rowClassName?.(row.original) ?? ''}`}>
                    {row.getVisibleCells().map((cell) => {
                      const pinned = cell.column.getIsPinned() === 'left'
                      const isLastPinned = pinned && cell.column.getIsLastColumn('left')
                      const left = pinned ? cell.column.getStart('left') : undefined
                      const isSelect = cell.column.id === '__select'
                      const raw = cell.getValue()
                      const title = !isSelect && typeof raw === 'string' && raw ? raw : undefined
                      return (
                        <td
                          key={cell.id}
                          title={title}
                          style={{ width: cell.column.getSize(), left }}
                          className={`border-b border-zinc-100 py-3.5 ${isSelect ? 'px-3 text-center' : 'truncate px-6'} ${pinned ? 'sticky z-10 bg-white group-hover:bg-zinc-50' : ''} ${isLastPinned ? 'border-r border-zinc-200' : ''}`}
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
      )}
    </div>
  )
}

function CheckboxCell({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: unknown) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked
  }, [indeterminate, checked])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
    />
  )
}

