'use client'

import { useEffect, useState, useTransition } from 'react'
import { EVAL_SYMPTOMS, type EvalVerdict, type GradingEval } from '@/lib/evals'
import { getGradingEval, setGradingEval } from '@/app/(protected)/admissions/challenge/evals'

// Reusable inline eval control for one grading event (context + question + learner).
// Drop into any view that shows the AI grader's output. Snapshots the judged AI
// output at save time so the label stays meaningful if the grader re-runs.
export default function EvalTagger({
  context,
  questionId,
  learnerEmail,
  attemptAt,
  aiScore,
  aiFeedback,
  scorecardSnapshot,
  preloaded,
  initial,
  onSaved,
}: {
  context: string
  questionId: string
  learnerEmail: string
  attemptAt: string
  aiScore?: string | null
  aiFeedback?: string | null
  scorecardSnapshot?: string | null
  preloaded?: boolean // caller supplies `initial` (skip the per-mount fetch)
  initial?: GradingEval | null
  onSaved?: (e: GradingEval) => void
}) {
  const [verdict, setVerdict] = useState<EvalVerdict | null>(null)
  const [symptoms, setSymptoms] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [existing, setExisting] = useState<GradingEval | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    function apply(e: GradingEval | null) {
      if (!e) return
      setExisting(e)
      setVerdict(e.verdict)
      setSymptoms(e.symptoms)
      setComment(e.comment ?? '')
    }
    if (preloaded) {
      apply(initial ?? null)
      return
    }
    let cancelled = false
    getGradingEval(context, questionId, learnerEmail, attemptAt)
      .then((e) => {
        if (!cancelled) apply(e)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, questionId, learnerEmail, attemptAt])

  function toggleSymptom(key: string) {
    setSaved(false)
    setSymptoms((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]))
  }

  function pick(v: EvalVerdict) {
    setSaved(false)
    setError(null)
    setVerdict(v)
    if (v === 'correct') setSymptoms([])
  }

  function save() {
    if (!verdict) return
    setError(null)
    startTransition(async () => {
      const res = await setGradingEval({
        context,
        questionId,
        learnerEmail,
        attemptAt,
        verdict,
        symptoms,
        comment,
        aiScore,
        aiFeedback,
        scorecardSnapshot,
      })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setExisting(res.data)
      setSaved(true)
      onSaved?.(res.data)
    })
  }

  const THUMB_UP =
    'M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904M14.25 9h2.25M5.904 18.75c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 10.203 4.167 9.75 5 9.75h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z'
  const THUMB_DOWN =
    'M7.5 15h2.25m8.024-9.75c.011.05.028.1.052.148.591 1.2.924 2.55.924 3.977a8.96 8.96 0 0 1-.999 4.125m.023-8.25c-.076-.365.183-.75.575-.75h.908c.889 0 1.713.518 1.972 1.368.339 1.11.521 2.287.521 3.507 0 1.553-.295 3.036-.831 4.398C20.613 14.547 19.833 15 19 15h-1.053c-.472 0-.745-.556-.5-.96a8.95 8.95 0 0 0 .303-.54m.023-8.25H16.48a4.5 4.5 0 0 1-1.423-.23l-3.114-1.04a4.5 4.5 0 0 0-1.423-.23H6.504c-.618 0-1.217.247-1.605.729A11.95 11.95 0 0 0 2.25 12c0 .434.023.863.068 1.285.09.921 1.028 1.615 2.054 1.615h3.126c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 21a2.25 2.25 0 0 0 2.25 2.25c.414 0 .75-.336.75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.331 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08Z'
  const thumb = (v: EvalVerdict, path: string, label: string, activeCls: string) => (
    <button
      onClick={() => pick(v)}
      aria-label={label}
      aria-pressed={verdict === v}
      title={label}
      className={`rounded-lg p-2 ring-1 ${
        verdict === v ? activeCls : 'bg-white text-zinc-400 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-600'
      }`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </button>
  )

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Rate this AI feedback</div>
        {existing?.labeledByName && !saved && (
          <div className="text-[11px] text-zinc-400">Last: {existing.labeledByName}</div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {thumb('correct', THUMB_UP, 'Feedback looks right', 'bg-emerald-600 text-white ring-emerald-600')}
        {thumb('incorrect', THUMB_DOWN, 'Feedback needs fixing', 'bg-red-600 text-white ring-red-600')}
      </div>

      {verdict === 'incorrect' && (
        <div className="mt-3">
          <div className="mb-1.5 text-[11px] font-medium text-zinc-500">What&apos;s wrong? (pick all that apply)</div>
          <div className="flex flex-wrap gap-1.5">
            {EVAL_SYMPTOMS.map((s) => (
              <button
                key={s.key}
                onClick={() => toggleSymptom(s.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${
                  symptoms.includes(s.key)
                    ? 'bg-amber-500 text-white ring-amber-500'
                    : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {verdict && (
        <textarea
          value={comment}
          onChange={(e) => {
            setSaved(false)
            setComment(e.target.value)
          }}
          rows={2}
          placeholder="Comment (optional) — e.g. what the feedback should have said."
          className="mt-3 w-full resize-y rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
        />
      )}

      {verdict && (
        <div className="mt-2.5 flex items-center gap-3">
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#4e9c4e] disabled:opacity-50"
          >
            {pending ? 'Saving…' : existing ? 'Update label' : 'Save label'}
          </button>
          {saved && <span className="text-[11px] font-medium text-emerald-600">Saved ✓</span>}
          {error && <span className="text-[11px] text-red-600">{error}</span>}
        </div>
      )}
    </div>
  )
}
