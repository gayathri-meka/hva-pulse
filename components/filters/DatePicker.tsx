'use client'

import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { format as fmt, parse as parseDate } from 'date-fns'

// Pill-style date picker used across the Learning surface. Trigger shows
// DD/MM/YYYY, popover wraps react-day-picker with Pulse-green overrides
// (configured globally in app/globals.css under `.rdp-root`).
//
// - `value`: ISO YYYY-MM-DD. Empty string represents "All dates" (only
//   meaningful when `showAllDates` is true).
// - `validDates`: optional. When provided, dates outside the set are greyed
//   out and the "Today" shortcut is disabled if today isn't in the set.
// - `showAllDates`: optional. When true, renders an "All dates" toggle row
//   inside the popover.
export default function DatePicker({
  value,
  onChange,
  validDates,
  showAllDates = false,
}: {
  value:         string
  onChange:      (iso: string) => void
  validDates?:   Set<string>
  showAllDates?: boolean
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

  const isAllDates   = showAllDates && value === ''
  const selectedDate = !isAllDates && value ? parseDate(value, 'yyyy-MM-dd', new Date()) : undefined
  const todayDate    = new Date()

  function pick(d: Date | undefined) {
    if (!d) return
    onChange(fmt(d, 'yyyy-MM-dd'))
    setOpen(false)
  }

  const isDisabled = validDates
    ? (d: Date) => !validDates.has(fmt(d, 'yyyy-MM-dd'))
    : undefined

  const defaultMonth = (() => {
    if (selectedDate) return selectedDate
    if (validDates && validDates.size > 0) {
      const latest = Array.from(validDates).sort().reverse()[0]
      return parseDate(latest, 'yyyy-MM-dd', new Date())
    }
    return todayDate
  })()

  const todayIso = fmt(todayDate, 'yyyy-MM-dd')
  const todayDisabled = validDates ? !validDates.has(todayIso) : false

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-50 focus:outline-none ${
          open ? 'border-[#5BAE5B]' : 'border-zinc-300 text-zinc-700'
        }`}
        aria-label="Choose date"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
        </svg>
        <span>{isAllDates ? 'All dates' : formatDate(value)}</span>
        <svg className="h-3 w-3 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-lg">
          {showAllDates && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className={`mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                isAllDates ? 'bg-[#5BAE5B] text-white' : 'text-zinc-700 hover:bg-zinc-100'
              }`}
            >
              <span>All dates</span>
              {isAllDates && (
                <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          )}
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={pick}
            disabled={isDisabled}
            defaultMonth={defaultMonth}
            weekStartsOn={1}
            showOutsideDays
            today={todayDate}
            captionLayout="dropdown"
            startMonth={new Date(2024, 0)}
            endMonth={new Date(todayDate.getFullYear() + 1, 11)}
          />
          <div className="flex justify-between border-t border-zinc-100 pt-2">
            <button
              type="button"
              onClick={() => pick(todayDate)}
              disabled={todayDisabled}
              className="rounded-md px-2 py-1 text-xs font-medium text-[#5BAE5B] hover:bg-[#5BAE5B]/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
