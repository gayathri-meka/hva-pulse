'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ScoreRow } from '../cockpit-actions'

export default function NotesSearch({ rows }: { rubrics: { key: string; label: string }[]; rows: ScoreRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return rows.filter((r) => `${r.candidateName ?? ''} ${r.candidateEmail}`.toLowerCase().includes(q)).slice(0, 10)
  }, [query, rows])

  return (
    <div className="mt-6 max-w-xl">
      <label htmlFor="learner-notes-search" className="mb-1.5 block text-sm font-medium text-zinc-700">Search learner by name</label>
      <input id="learner-notes-search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Start typing a learner name…" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#5BAE5B] focus:ring-2 focus:ring-[#5BAE5B]/15" />
      {query.trim() && (
        <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          {matches.length ? matches.map((row) => (
            <button key={row.interviewId} type="button" onClick={() => router.push(`/admissions/interviews/notes/${row.interviewId}`)} className="flex w-full items-center justify-between border-b border-zinc-100 px-3 py-2.5 text-left last:border-0 hover:bg-zinc-50">
              <span><span className="block text-sm font-medium text-zinc-900">{row.candidateName ?? row.candidateEmail}</span><span className="block text-xs text-zinc-500">{row.candidateEmail}</span></span>
              <span className="text-xs font-medium text-[#5BAE5B]">Open notes →</span>
            </button>
          )) : <p className="px-3 py-4 text-sm text-zinc-500">No learner found.</p>}
        </div>
      )}
    </div>
  )
}
