'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { INDIAN_COLLEGES } from '@/lib/colleges'

const MAX_RESULTS = 8

export default function CollegeAutocomplete({
  id,
  value,
  onChange,
  onBlur,
  error,
  hint,
  placeholder,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string
  hint?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const query = value.trim()
  const queryLower = query.toLowerCase()

  const matches = useMemo(() => {
    if (!queryLower) return []
    const exact: string[] = []
    const prefix: string[] = []
    const contains: string[] = []
    for (const c of INDIAN_COLLEGES) {
      const lower = c.toLowerCase()
      if (lower === queryLower) exact.push(c)
      else if (lower.startsWith(queryLower)) prefix.push(c)
      else if (lower.includes(queryLower)) contains.push(c)
      if (exact.length + prefix.length + contains.length > MAX_RESULTS * 3) break
    }
    return [...exact, ...prefix, ...contains].slice(0, MAX_RESULTS)
  }, [queryLower])

  // Don't show dropdown if user has selected an exact match (no need to re-prompt).
  const isExactMatch = matches.length > 0 && matches[0].toLowerCase() === queryLower
  const showDropdown = open && matches.length > 0 && !isExactMatch

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectCollege(college: string) {
    onChange(college)
    setOpen(false)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pick = matches[highlighted]
      if (pick) selectCollege(pick)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative mb-5" ref={containerRef}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-bold text-zinc-700">
        College name
        <span className="ml-0.5 text-red-600">*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
            setHighlighted(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={onBlur}
          onKeyDown={handleKey}
          autoComplete="off"
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={`${id}-listbox`}
          className={`w-full rounded-xl border-2 bg-zinc-50 px-3.5 py-3 pr-10 text-[15px] text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-[#16a34a] focus:bg-white focus:ring-4 focus:ring-[#16a34a]/15 ${
            error ? 'border-red-500 bg-red-50/40' : 'border-zinc-300'
          }`}
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
            aria-label="Clear college name"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <IconX size={14} stroke={2.5} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg"
        >
          {matches.map((college, i) => (
            <button
              key={college}
              role="option"
              aria-selected={i === highlighted}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                selectCollege(college)
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`block w-full px-3.5 py-2.5 text-left text-[14px] transition-colors ${
                i === highlighted
                  ? 'bg-[#dcfce7] text-[#166534]'
                  : 'text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {highlightMatch(college, query)}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="mt-1.5 text-[12px] font-semibold text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-zinc-500">{hint}</p>
      ) : null}
    </div>
  )
}

function highlightMatch(text: string, query: string) {
  if (!query) return text
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const idx = lowerText.indexOf(lowerQuery)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-extrabold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}
