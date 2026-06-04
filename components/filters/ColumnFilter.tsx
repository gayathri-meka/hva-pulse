'use client'

import { useEffect, useRef, useState } from 'react'

// Compact multi-select for table column headers. Empty selection = no filter.
// Smaller / lighter than `MultiSelect` so it sits neatly under a column title.
export default function ColumnFilter({
  options,
  selected,
  onChange,
}: {
  options:  { value: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const label =
    selected.size === 0
      ? 'All'
      : selected.size === 1
        ? (options.find((o) => o.value === Array.from(selected)[0])?.label ?? '1')
        : `${selected.size} selected`

  function toggle(val: string) {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded border bg-white px-2 py-0.5 text-left text-[11px] font-normal normal-case tracking-normal focus:outline-none ${
          selected.size > 0 ? 'border-[#5BAE5B] text-zinc-900' : 'border-zinc-200 text-zinc-500'
        }`}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3 w-3 shrink-0 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-0.5 max-h-52 min-w-[140px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => { onChange(new Set()); setOpen(false) }}
              className="w-full border-b border-zinc-100 px-3 py-1 text-left text-xs text-blue-500 hover:bg-zinc-50"
            >
              Clear filter
            </button>
          )}
          {options.length === 0 ? (
            <p className="px-3 py-1 text-xs text-zinc-400">No values</p>
          ) : options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// Sticky <th> cell — keeps headers + filters in view as the body scrolls.
export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-10 bg-zinc-50 px-4 py-2 align-top">
      <div className="flex flex-col gap-1">{children}</div>
    </th>
  )
}

export function ThLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
      {children}
    </span>
  )
}
