'use client'

import { useState, useRef, useEffect } from 'react'

export interface MultiSelectOption {
  id:    string
  label: string
}

interface Props {
  options:     MultiSelectOption[]
  selectedIds: string[]
  onChange:    (ids: string[]) => void
  placeholder: string
  className?:  string
}

export default function MultiSelectChips({
  options,
  selectedIds,
  onChange,
  placeholder,
  className = '',
}: Props) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  const selectedSet = new Set(selectedIds)
  const selected    = options.filter((o) => selectedSet.has(o.id))

  const q = query.trim().toLowerCase()
  const filtered = options
    .filter((o) => !selectedSet.has(o.id))
    .filter((o) => !q || o.label.toLowerCase().includes(q))
    .slice(0, 50)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function add(id: string) {
    if (selectedSet.has(id)) return
    onChange([...selectedIds, id])
    setQuery('')
    inputRef.current?.focus()
  }

  function remove(id: string) {
    onChange(selectedIds.filter((x) => x !== id))
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !query && selectedIds.length > 0) {
      e.preventDefault()
      remove(selectedIds[selectedIds.length - 1])
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault()
      add(filtered[0].id)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 focus-within:ring-2 focus-within:ring-zinc-900 focus-within:ring-offset-1"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map((o) => (
          <span
            key={o.id}
            className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800"
          >
            {o.label}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(o.id) }}
              className="text-zinc-500 hover:text-zinc-800"
              aria-label={`Remove ${o.label}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selected.length === 0 ? placeholder : ''}
          className="min-w-[80px] flex-1 bg-transparent py-1 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none"
          autoComplete="off"
        />
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-60 w-full min-w-[200px] overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {filtered.map((o) => (
            <li
              key={o.id}
              onMouseDown={(e) => { e.preventDefault(); add(o.id) }}
              className="cursor-pointer px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {open && q && filtered.length === 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-400 shadow-lg">
          No matches
        </ul>
      )}
    </div>
  )
}
