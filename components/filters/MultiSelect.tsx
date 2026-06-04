'use client'

import { useEffect, useRef, useState } from 'react'

// Pill-style multi-select used across the Learning surface. Empty selection
// (or "Select all" off) means "no filter".
export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label:    string
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

  const allSelected  = selected.size > 0 && selected.size === options.length
  const noneSelected = selected.size === 0
  const displayText =
    allSelected   ? 'All'  :
    noneSelected  ? 'None' :
    selected.size === 1
      ? options.find((o) => o.value === Array.from(selected)[0])?.label ?? '1 selected'
      : `${selected.size} selected`

  function toggle(val: string) {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  function toggleAll() {
    if (allSelected) onChange(new Set())
    else onChange(new Set(options.map((o) => o.value)))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium focus:outline-none ${
          allSelected || noneSelected ? 'border-zinc-300 text-zinc-700' : 'border-[#5BAE5B]/50 text-zinc-900'
        }`}
      >
        <span className="text-zinc-500">{label}:</span>
        <span className="max-w-[180px] truncate">{displayText}</span>
        <svg className="h-3 w-3 shrink-0 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 min-w-[220px] overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]" />
            Select all
          </label>
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-400">No options</p>
          ) : options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]"
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
