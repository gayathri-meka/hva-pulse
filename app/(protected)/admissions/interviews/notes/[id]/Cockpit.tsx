'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveNote, saveScore, submitAssessment, type CockpitData } from '../../cockpit-actions'
import { averageScore, RECOMMENDATIONS, type InterviewQuestion, type InterviewRubric } from '@/lib/interviewCockpit'
import { roundLabel } from '@/lib/interviews'
import type { CriterionResult } from '@/lib/challengeReview'

const REC_TONE: Record<string, string> = {
  advance: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  borderline: 'border-amber-500 bg-amber-50 text-amber-700',
  no: 'border-red-500 bg-red-50 text-red-700',
}

function whenLabel(iso: string) {
  // Pin to IST so server (UTC) and client (browser TZ) render the same string —
  // otherwise the date text mismatches and React throws a hydration error.
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
}

export default function Cockpit({ data }: { data: CockpitData }) {
  const router = useRouter()
  const { interview, dossier, questions, rubrics } = data

  const [scores, setScores] = useState<Record<string, number>>(data.scores)
  const [recommendation, setRecommendation] = useState<string | null>(interview.recommendation)
  const [summary, setSummary] = useState(interview.summary ?? '')
  const [submitting, startSubmit] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(!!interview.assessedAt)
  const [showDossier, setShowDossier] = useState(true)

  const setScore = useCallback((rubricKey: string, score: number) => {
    setScores((prev) => ({ ...prev, [rubricKey]: score }))
    saveScore(interview.id, rubricKey, score).then((r) => { if (!r.ok) setError(r.error) })
  }, [interview.id])

  const avg = averageScore(scores)

  function submit() {
    setError(null)
    if (!recommendation) { setError('Pick a recommendation before submitting.'); return }
    startSubmit(async () => {
      const r = await submitAssessment({ interviewId: interview.id, recommendation, summary })
      if (!r.ok) { setError(r.error); return }
      setSubmitted(true)
      router.refresh()
    })
  }

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admissions/interviews/notes" className="text-xs font-medium text-zinc-400 hover:text-zinc-600">← Interview notes</Link>
          <h1 className="mt-1 text-lg font-bold tracking-tight text-zinc-900">
            {interview.candidateName ?? interview.candidateEmail}
            <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-zinc-500">{roundLabel(interview.round)}</span>
            {submitted && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 align-middle text-[11px] font-semibold text-emerald-700">Assessed</span>}
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">{whenLabel(interview.scheduledAt)}</p>
        </div>
        <button
          onClick={() => setShowDossier((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${showDossier ? 'border-zinc-300 bg-zinc-100 text-zinc-700' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}
        >
          📋 Dossier
        </button>
        {interview.meetLink && (
          <a href={interview.meetLink} target="_blank" rel="noreferrer" className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e9c4e]">
            Join Google Meet ↗
          </a>
        )}
      </div>

      <div className="@container">
       <div className={showDossier ? 'grid grid-cols-1 gap-6 @2xl:grid-cols-3' : ''}>
        {/* Left — candidate dossier, pinned alongside the notes (toggled by the Dossier button) */}
        {showDossier && (
        <aside className="min-w-0 @2xl:sticky @2xl:top-4 @2xl:self-start">
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-900">Candidate dossier</h2>
              <p className="text-[11px] text-zinc-400">From the challenge decision snapshot.</p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
              <DossierPane dossier={dossier} />
            </div>
          </div>
        </aside>
        )}

        {/* Main — questions + assessment */}
        <div className={`min-w-0 space-y-4 ${showDossier ? '@2xl:col-span-2' : ''}`}>
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">Questions</h2>
            {questions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 bg-white px-4 py-6 text-center text-sm text-zinc-400">
                No questions configured for this round yet.
              </p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <QuestionCard key={q.id} n={i + 1} question={q} interviewId={interview.id} initialNote={data.notes[q.id] ?? ''} onError={setError} />
                ))}
              </div>
            )}
          </section>

          {/* Rubric scoring */}
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Assessment</h2>
              {avg != null && <span className="text-sm text-zinc-500">Avg <span className="font-bold text-zinc-900">{avg}</span> / 4</span>}
            </div>
            <div className="mt-3 space-y-4">
              {rubrics.map((r) => (
                <RubricRow key={r.key} rubric={r} value={scores[r.key] ?? null} onPick={(s) => setScore(r.key, s)} />
              ))}
            </div>

            {/* Recommendation */}
            <div className="mt-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recommendation</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {RECOMMENDATIONS.map((rec) => {
                  const active = recommendation === rec.key
                  return (
                    <button
                      key={rec.key}
                      onClick={() => setRecommendation(rec.key)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${active ? REC_TONE[rec.key] : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50'}`}
                    >
                      {rec.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Summary */}
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Summary (optional)</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
                placeholder="Overall impression, standout moments, concerns…"
                className="mt-1.5 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#5BAE5B] focus:outline-none"
              />
            </div>

            {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={submit}
                disabled={submitting}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : submitted ? 'Update assessment' : 'Submit assessment'}
              </button>
              <span className="text-xs text-zinc-400">Notes &amp; scores save automatically as you go.</span>
            </div>
          </section>
        </div>
       </div>
      </div>
    </div>
  )
}

// ── Dossier ───────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{children}</div>
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 shrink-0 text-emerald-500">
      <path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.42 0L3.3 9.7a1 1 0 011.4-1.42l3.29 3.3 6.79-6.8a1 1 0 011.42 0z" clipRule="evenodd" />
    </svg>
  )
}
const groupTag = (g: string) => (g === 'Engagement' ? 'Challenge' : g)

// Triage view: fails + data-gaps first (what to probe), then passing signals to
// confirm, then non-gating context.
function DossierPane({ dossier }: { dossier: CriterionResult[] }) {
  if (dossier.length === 0) {
    return <p className="text-xs text-zinc-400">No challenge decision snapshot on file for this candidate.</p>
  }
  // The interviewer IS the team, so show everything — including internal-only fails.
  const shown = dossier.filter((c) => !c.disabled)
  const info = shown.filter((c) => c.informational)
  const graded = shown.filter((c) => !c.informational)
  const watchouts = graded.filter((c) => c.status === 'fail' || c.undetermined)
  const clears = graded.filter((c) => c.status === 'pass')
  const neutral = graded.filter((c) => c.status === 'na' && !c.undetermined)

  return (
    <div className="space-y-5">
      {watchouts.length > 0 && (
        <section>
          <SectionLabel>Probe these · {watchouts.length}</SectionLabel>
          <div className="mt-2 space-y-2">
            {watchouts.map((c) => {
              const amber = c.status !== 'fail' // undetermined = data gap, not a hard fail
              return (
                <div key={c.key} className={`rounded-lg border-l-2 p-2.5 ${amber ? 'border-amber-400 bg-amber-50/60' : 'border-red-400 bg-red-50/60'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold text-zinc-800">{c.label}</span>
                    <span className={`shrink-0 text-xs font-semibold ${amber ? 'text-amber-700' : 'text-red-700'}`}>{c.value}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                    {c.failFeedback || (amber ? 'Data missing — confirm with the candidate.' : 'Below threshold.')}
                    {c.threshold ? <span className="text-zinc-400"> · rule {c.threshold}</span> : null}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {clears.length > 0 && (
        <section>
          <SectionLabel>Looks good · {clears.length}</SectionLabel>
          <ul className="mt-2 space-y-1">
            {clears.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="flex min-w-0 items-center gap-1.5 text-zinc-600">
                  <CheckIcon /><span className="truncate">{c.label}</span>
                  <span className="shrink-0 text-[10px] text-zinc-300">{groupTag(c.group)}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-zinc-800">{c.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {info.length > 0 && (
        <section>
          <SectionLabel>Context</SectionLabel>
          <ul className="mt-2 space-y-1">
            {info.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-zinc-500">{c.label}</span>
                <span className="shrink-0 text-zinc-700">{c.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {neutral.length > 0 && (
        <p className="text-[11px] text-zinc-400">{neutral.length} other {neutral.length === 1 ? 'criterion' : 'criteria'} not applicable.</p>
      )}
    </div>
  )
}

// ── Question card with collapsed guidance + autosaving note ─────────────────
function QuestionCard({ n, question, interviewId, initialNote, onError }: {
  n: number
  question: InterviewQuestion
  interviewId: string
  initialNote: string
  onError: (e: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState(initialNote)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced autosave.
  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  function onChange(v: string) {
    setNote(v)
    setSaved('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const r = await saveNote(interviewId, question.id, v)
      if (!r.ok) { onError(r.error); setSaved('idle') } else setSaved('saved')
    }, 700)
  }

  const hasGuidance = question.purpose || question.strongAnswer || question.weakAnswer || question.probe

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-900">
          <span className="mr-1.5 text-zinc-400">{n}.</span>{question.prompt}
        </p>
        {hasGuidance && (
          <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-zinc-600">
            {open ? 'Hide guidance' : 'Guidance'}
          </button>
        )}
      </div>

      {open && hasGuidance && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-zinc-50 p-3 text-[12px] leading-relaxed">
          {question.purpose && <p><span className="font-semibold text-zinc-500">What we&apos;re assessing: </span><span className="text-zinc-600">{question.purpose}</span></p>}
          {question.strongAnswer && <p><span className="font-semibold text-emerald-600">Strong: </span><span className="text-zinc-600">{question.strongAnswer}</span></p>}
          {question.weakAnswer && <p><span className="font-semibold text-red-600">Weak: </span><span className="text-zinc-600">{question.weakAnswer}</span></p>}
          {question.probe && <p><span className="font-semibold text-zinc-500">Probe: </span><span className="text-zinc-600">{question.probe}</span></p>}
        </div>
      )}

      <div className="relative mt-2">
        <textarea
          value={note}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Notes…"
          className="w-full resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-[#5BAE5B] focus:outline-none"
        />
        <span className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-zinc-300">
          {saved === 'saving' ? 'saving…' : saved === 'saved' ? 'saved' : ''}
        </span>
      </div>
    </div>
  )
}

// Weakest → strongest tone for a selected score.
const SCORE_TONE = [
  'bg-red-600 text-white',
  'bg-amber-500 text-white',
  'bg-orange-500 text-white',
  'bg-emerald-600 text-white',
]

const LEVEL_CHIP = ['bg-red-100 text-red-700', 'bg-amber-100 text-amber-700', 'bg-orange-100 text-orange-700', 'bg-emerald-100 text-emerald-700']

// ── Rubric row: 1–4 buttons on a weak→strong scale, with collapsible guidance ─
function RubricRow({ rubric, value, onPick }: { rubric: InterviewRubric; value: number | null; onPick: (s: number) => void }) {
  const [open, setOpen] = useState(false)
  const hasGuide = rubric.examples.some((e) => e.trim()) || rubric.lookingFor.some((e) => e.trim())

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-800">{rubric.label}</span>
            {hasGuide && (
              <button onClick={() => setOpen((o) => !o)} className="shrink-0 text-[11px] font-medium text-zinc-400 hover:text-zinc-600">
                {open ? 'Hide guide' : 'Guide'}
              </button>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 hidden text-[10px] uppercase tracking-wide text-zinc-300 sm:inline">weak</span>
          {[1, 2, 3, 4].map((s) => {
            const active = value === s
            return (
              <button
                key={s}
                onClick={() => onPick(s)}
                title={rubric.levels[s - 1] || `Score ${s}`}
                className={`h-8 w-8 rounded-md text-sm font-semibold transition-colors ${active ? SCORE_TONE[s - 1] : 'border border-zinc-200 text-zinc-400 hover:bg-zinc-50'}`}
              >
                {s}
              </button>
            )
          })}
          <span className="ml-1 hidden text-[10px] uppercase tracking-wide text-zinc-300 sm:inline">strong</span>
        </div>
      </div>

      {value != null && rubric.levels[value - 1] && (
        <p className="mt-1 text-[11px] leading-snug text-zinc-500">{rubric.levels[value - 1]}</p>
      )}

      {open && (
        <div className="mt-2 space-y-2.5 rounded-lg bg-zinc-50 p-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-2">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${LEVEL_CHIP[i]}`}>{i + 1}</span>
              <div className="min-w-0 text-[12px] leading-snug">
                <span className="font-medium text-zinc-700">{rubric.levels[i] || <span className="font-normal text-zinc-300">—</span>}</span>
                {rubric.lookingFor[i]?.trim() && (
                  <p className="mt-0.5 text-[11px] text-zinc-500"><span className="text-zinc-400">Looking for: </span>{rubric.lookingFor[i]}</p>
                )}
                {rubric.examples[i]?.trim() && (
                  <p className="mt-0.5 whitespace-pre-wrap text-[11px] italic text-zinc-400">e.g. {rubric.examples[i]}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
