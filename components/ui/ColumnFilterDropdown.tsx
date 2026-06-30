'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Column } from '@tanstack/react-table'

// Per-column multi-select filter dropdown with search-within and faceted counts.
// Shared by DataTable and any custom TanStack table (e.g. the challenge tables).
// Array-valued columns supply their options via columnDef.meta.facetOptions.
export default function ColumnFilterDropdown({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  column: Column<any, unknown>
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [q, setQ] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const selected = (column.getFilterValue() as string[]) ?? []

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
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', () => setOpen(false))
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  const metaOptions = (column.columnDef.meta as { facetOptions?: string[] } | undefined)?.facetOptions
  const options = useMemo<readonly (readonly [string, number | undefined])[]>(
    () =>
      metaOptions
        ? metaOptions.filter((v) => v != null && v !== '').map((v) => [String(v), undefined] as const).sort((a, b) => a[0].localeCompare(b[0]))
        : Array.from(column.getFacetedUniqueValues().entries())
            .filter(([v]) => v != null && v !== '')
            .map(([v, count]) => [String(v), count as number] as const)
            .sort((a, b) => a[0].localeCompare(b[0])),
    [column, open, metaOptions],
  )
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? options.filter(([o]) => o.toLowerCase().includes(needle)) : options
  }, [options, q])

  function toggle(val: string) {
    const next = selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    column.setFilterValue(next.length ? next : undefined)
  }

  const label = selected.length === 0 ? 'All' : selected.length === 1 ? selected[0] : `${selected.length} selected`

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded border bg-white px-2 py-0.5 text-left text-[11px] font-normal normal-case tracking-normal focus:outline-none ${selected.length ? 'border-[#5BAE5B] text-zinc-900' : 'border-zinc-200 text-zinc-500'}`}
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
          className="fixed z-50 w-56 rounded border border-zinc-200 bg-white py-1 shadow-lg"
        >
          <div className="px-2 pb-1 pt-1">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="w-full rounded border border-zinc-200 px-2 py-1 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
            />
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => { column.setFilterValue(undefined); setOpen(false) }}
              className="w-full border-b border-zinc-100 px-3 py-1 text-left text-xs text-blue-500 hover:bg-zinc-50"
            >
              Clear filter
            </button>
          )}
          <div className="max-h-52 overflow-y-auto">
            {shown.map(([opt, count]) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]"
                />
                <span className="flex-1 truncate">{opt}</span>
                <span className="shrink-0 text-[10px] text-zinc-400">{count}</span>
              </label>
            ))}
            {shown.length === 0 && <p className="px-3 py-1.5 text-xs text-zinc-400">No matches</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
