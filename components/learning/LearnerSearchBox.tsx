'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type LearnerOption = { learner_id: string; name: string; email: string }

interface Props {
  learners:   LearnerOption[]
  selectedId: string | null
}

export default function LearnerSearchBox({ learners, selectedId }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery]   = useState('')
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef<HTMLDivElement>(null)

  const selected = selectedId ? learners.find((l) => l.learner_id === selectedId) : null

  const filtered = query.trim()
    ? learners.filter((l) =>
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.email.toLowerCase().includes(query.toLowerCase())
      )
    : learners

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function select(learner: LearnerOption) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', 'interventions')
    params.set('learner', learner.learner_id)
    router.push(`/learning?${params.toString()}`)
    setOpen(false)
    setQuery('')
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString())
    params.set('filter', 'interventions')
    params.delete('learner')
    router.push(`/learning?${params.toString()}`)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative max-w-sm">
      {selected && !open ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
          <span className="flex-1 text-sm font-medium text-zinc-900">{selected.name}</span>
          <button
            onClick={clear}
            className="text-zinc-400 hover:text-zinc-600"
            title="Clear selection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          >
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Search learner by name or email…"
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          />
        </div>
      )}

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full min-w-[320px] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-zinc-400">No learners found</p>
          ) : (
            filtered.map((l) => (
              <button
                key={l.learner_id}
                onClick={() => select(l)}
                className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-zinc-50"
              >
                <span className="text-sm font-medium text-zinc-900">{l.name}</span>
                <span className="text-xs text-zinc-400">{l.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
