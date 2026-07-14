'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { searchInterviewNotes, type NoteBundle } from '../cockpit-actions'
import { roundLabel, formatDateTimeIST } from '@/lib/interviews'

const REC_STYLE: Record<string, string> = {
  advance: 'bg-emerald-50 text-emerald-700',
  borderline: 'bg-amber-50 text-amber-700',
  no: 'bg-red-50 text-red-700',
}
const REC_LABEL: Record<string, string> = { advance: 'Advance', borderline: 'Borderline', no: 'Do not advance' }
const SCORE_TONE = ['bg-red-100 text-red-700', 'bg-amber-100 text-amber-700', 'bg-orange-100 text-orange-700', 'bg-emerald-100 text-emerald-700']

const when = formatDateTimeIST

export default function NotesSearch({ initial, initialQuery = '' }: { initial: NoteBundle[]; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<NoteBundle[]>(initial)
  const [pending, start] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Skip the first debounced fetch — the server already searched initialQuery.
  const primed = useRef(false)

  useEffect(() => {
    if (!primed.current) { primed.current = true; return }
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      start(async () => setResults(await searchInterviewNotes(query)))
    }, 300)
    return () => { if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  // Group interviews under each candidate.
  const groups = useMemo(() => {
    const m = new Map<string, { name: string | null; email: string; items: NoteBundle[] }>()
    for (const b of results) {
      const g = m.get(b.candidateEmail) ?? { name: b.candidateName, email: b.candidateEmail, items: [] }
      g.items.push(b)
      m.set(b.candidateEmail, g)
    }
    return [...m.values()]
  }, [results])

  return (
    <div className="mt-5">
      <div className="relative max-w-md">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search candidate name or email…"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#5BAE5B] focus:outline-none"
        />
        {pending && <span className="absolute right-3 top-2.5 text-xs text-zinc-400">searching…</span>}
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-400">{query ? 'No interviews found for that candidate.' : 'No interview notes captured yet.'}</p>
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <div key={g.email}>
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-bold text-zinc-900">{g.name ?? g.email}</h2>
                {g.name && <span className="text-xs text-zinc-400">{g.email}</span>}
              </div>
              <div className="mt-2 space-y-3">
                {g.items.map((b) => <InterviewNotes key={b.interviewId} bundle={b} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InterviewNotes({ bundle: b }: { bundle: NoteBundle }) {
  const empty = b.notes.length === 0 && b.scores.length === 0 && !b.summary && !b.recommendation
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-semibold text-zinc-600">{roundLabel(b.round)}</span>
          <span className="text-zinc-500">{when(b.scheduledAt)}</span>
          {b.interviewerName && <span className="text-zinc-400">· {b.interviewerName}</span>}
          {b.recommendation && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REC_STYLE[b.recommendation]}`}>{REC_LABEL[b.recommendation]}</span>}
        </div>
        <Link href={`/admissions/interviews/notes/${b.interviewId}`} className="whitespace-nowrap text-xs font-semibold text-[#5BAE5B] hover:underline">
          {empty ? 'Take notes' : 'Open'} →
        </Link>
      </div>

      {empty ? (
        <p className="mt-2 text-xs text-zinc-400">No notes captured yet.</p>
      ) : (
        <>
          {b.scores.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {b.scores.map((s) => (
                <span key={s.label} className="inline-flex items-center gap-1 rounded-md bg-zinc-50 px-2 py-1 text-[11px]">
                  <span className="text-zinc-500">{s.label}</span>
                  <span className={`flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold ${SCORE_TONE[s.score - 1] ?? 'bg-zinc-200'}`}>{s.score}</span>
                </span>
              ))}
            </div>
          )}
          {b.summary && (
            <p className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-700"><span className="font-semibold text-zinc-500">Summary: </span>{b.summary}</p>
          )}
          {b.notes.length > 0 && (
            <ul className="mt-3 space-y-2.5">
              {b.notes.map((n, i) => (
                <li key={i}>
                  <p className="text-[12px] font-medium text-zinc-500">{n.prompt}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-800">{n.note}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
