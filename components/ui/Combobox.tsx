'use client'

import { useState, useRef, useEffect } from 'react'

export interface ComboboxOption {
  id:    string
  label: string
}

interface Props {
  options:     ComboboxOption[]
  value:       string          // selected id
  onChange:    (id: string) => void
  placeholder: string
  className?:  string
}

export default function Combobox({ options, value, onChange, placeholder, className = '' }: Props) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)

  const selectedLabel = options.find((o) => o.id === value)?.label ?? ''

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setOpen(true)
    // If user clears the input, clear selection too
    if (!e.target.value) onChange('')
  }

  function handleFocus() {
    setQuery('')
    setOpen(true)
  }

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  const inputCls = `w-full rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1 ${className}`

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={open ? query : selectedLabel}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      {/* Clear / chevron icon */}
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        {value && !open ? (
          <button
            type="button"
            className="pointer-events-auto text-zinc-400 hover:text-zinc-600"
            onMouseDown={(e) => { e.preventDefault(); select('') }}
            tabIndex={-1}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M5.28 4.22a.75.75 0 0 0-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 1 0 1.06 1.06L8 9.06l2.72 2.72a.75.75 0 1 0 1.06-1.06L9.06 8l2.72-2.72a.75.75 0 0 0-1.06-1.06L8 6.94 5.28 4.22Z" />
            </svg>
          </button>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
          </svg>
        )}
      </div>

      {open && (
        <ul className="absolute left-0 top-full z-20 mt-1 max-h-52 w-full min-w-[200px] overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <li
            onMouseDown={() => select('')}
            className="cursor-pointer px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-50"
          >
            {placeholder}
          </li>
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-400">No results</li>
          )}
          {filtered.map((o) => (
            <li
              key={o.id}
              onMouseDown={() => select(o.id)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                o.id === value ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
