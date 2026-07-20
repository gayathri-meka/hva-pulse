'use client'

import { useState, useTransition } from 'react'
import { IconSparkles } from '@tabler/icons-react'
import Modal from '@/components/placements/Modal'
import { reviewInterviewNotes, type NotesReviewResult } from '@/app/(protected)/admissions/interviews/cockpit-actions'
import { roundLabel } from '@/lib/interviews'

const QUALITY_STYLE: Record<NotesReviewResult['quality'], string> = {
  strong: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  adequate: 'bg-amber-50 text-amber-700 ring-amber-200',
  thin: 'bg-red-50 text-red-700 ring-red-200',
}
const QUALITY_LABEL: Record<NotesReviewResult['quality'], string> = {
  strong: 'Strong notes',
  adequate: 'Adequate notes',
  thin: 'Thin notes',
}
const SCORE_TONE = ['bg-red-100 text-red-700', 'bg-amber-100 text-amber-700', 'bg-orange-100 text-orange-700', 'bg-emerald-100 text-emerald-700']

function ScoreChip({ s }: { s: number | null }) {
  if (s == null) return <span className="text-zinc-300">—</span>
  return <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[12px] font-bold ${SCORE_TONE[s - 1] ?? 'bg-zinc-100'}`}>{s}</span>
}

export default function NotesReviewButton({
  interviewId,
  candidateName,
  round,
}: {
  interviewId: string
  candidateName: string
  round: 1 | 2
}) {
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<NotesReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function run() {
    setOpen(true)
    setError(null)
    setResult(null)
    start(async () => {
      const r = await reviewInterviewNotes(interviewId)
      if (r.ok) setResult(r.data)
      else setError(r.error)
    })
  }

  return (
    <>
      <button
        onClick={run}
        title="Ask AI to review these notes"
        className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-semibold text-zinc-500 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
      >
        <IconSparkles size={13} stroke={2} />
        AI check
      </button>

      {open && (
        <Modal title="AI notes review" onClose={() => setOpen(false)} wide>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-zinc-900">{candidateName}</span>
            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-500">{roundLabel(round)}</span>
            {result && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${QUALITY_STYLE[result.quality]}`}>
                {QUALITY_LABEL[result.quality]}
              </span>
            )}
          </div>

          {pending && (
            <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
              <IconSparkles size={16} className="animate-pulse text-violet-500" />
              Reading the notes and checking them against the rubric…
            </div>
          )}

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {result && (
            <div className="min-w-0 space-y-5">
              {/* Overall */}
              <p className="text-sm leading-relaxed text-zinc-700 break-words">{result.overall}</p>

              {/* Gaps by question */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Gaps by question</h3>
                {result.questionGaps.length === 0 ? (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">No major gaps — the notes cover the questions.</p>
                ) : (
                  <ul className="space-y-2">
                    {result.questionGaps.map((g, i) => (
                      <li key={i} className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
                        <div className="text-[13px] font-medium text-zinc-800">{g.question}</div>
                        <div className="mt-0.5 text-[13px] text-zinc-600">{g.issue}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Rating alignment */}
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Do the notes support the ratings?</h3>
                {result.ratingChecks.length === 0 ? (
                  <p className="text-sm text-zinc-400">No rubric scores to check.</p>
                ) : (
                  <div className="space-y-2">
                    {result.ratingChecks.map((c, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border px-3 py-2 ${c.aligned ? 'border-zinc-200 bg-white' : 'border-red-200 bg-red-50/50'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="min-w-0 text-[13px] font-medium text-zinc-800">{c.rubric}</span>
                          <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-500">
                            <span className="flex items-center gap-1">given <ScoreChip s={c.givenScore} /></span>
                            {c.aligned ? (
                              <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">supported ✓</span>
                            ) : (
                              <span className="flex items-center gap-1 whitespace-nowrap">→ suggests <ScoreChip s={c.suggestedScore} /></span>
                            )}
                          </div>
                        </div>
                        {c.rationale && <p className="mt-1 text-[12px] leading-snug text-zinc-600 break-words">{c.rationale}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <p className="border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
                AI-generated from the interviewer&apos;s notes and the rubric — a second opinion, not a decision. Verify before acting.
              </p>
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
