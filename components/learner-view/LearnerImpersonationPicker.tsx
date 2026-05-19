'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { startImpersonation } from '@/app/(protected)/learner-view/actions'

export type LearnerOption = {
  user_id: string
  name:    string
  email:   string
  batch:   string | null
}

interface Props {
  learners: LearnerOption[]
}

export default function LearnerImpersonationPicker({ learners }: Props) {
  const [query, setQuery]       = useState('')
  const [open,  setOpen]        = useState(false)
  const [isPending, startTrans] = useTransition()
  const [error, setError]       = useState('')
  const containerRef            = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const filtered = query.trim()
    ? learners.filter((l) =>
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.email.toLowerCase().includes(query.toLowerCase())
      )
    : learners

  function handlePick(userId: string) {
    setError('')
    startTrans(async () => {
      try {
        await startImpersonation(userId)
      } catch (e) {
        // redirect() throws NEXT_REDIRECT which is expected — swallow it
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('NEXT_REDIRECT')) return
        setError(msg)
      }
    })
  }

  return (
    <div ref={containerRef} className="relative max-w-xl">
      <div className="relative">
        <svg
          xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
        >
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search learner by name or email…"
          className="w-full rounded-lg border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
        />
      </div>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-400">No learners found</p>
          ) : (
            filtered.map((l) => (
              <button
                key={l.user_id}
                disabled={isPending}
                onClick={() => handlePick(l.user_id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-zinc-50 disabled:opacity-40"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-900">{l.name}</span>
                  <span className="text-xs text-zinc-400">{l.email}</span>
                </div>
                {l.batch && (
                  <span className="shrink-0 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{l.batch}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-[#E24B4A]">{error}</p>}
    </div>
  )
}
