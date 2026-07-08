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
    getGradingEval(context, questionId, learnerEmail)
      .then((e) => {
        if (!cancelled) apply(e)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, questionId, learnerEmail])

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

  const btn = (v: EvalVerdict, label: string, activeCls: string) => (
    <button
      onClick={() => pick(v)}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 ${
        verdict === v ? activeCls : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
      }`}
    >
      {label}
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
        {btn('correct', 'Looks right', 'bg-emerald-600 text-white ring-emerald-600')}
        {btn('incorrect', 'Needs fixing', 'bg-red-600 text-white ring-red-600')}
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
