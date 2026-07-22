'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { saveNote, saveScore, submitAssessment, type CockpitData } from '../../cockpit-actions'
import { averageScore, scoreTone, formatScore, RECOMMENDATIONS, type InterviewQuestion, type InterviewRubric } from '@/lib/interviewCockpit'
import { roundLabel, formatDateTimeIST } from '@/lib/interviews'
import type { CriterionResult } from '@/lib/challengeReview'
import type { IntakeGroup } from '@/lib/challengeIntakeDisplay'

const REC_TONE: Record<string, string> = {
  advance: 'border-emerald-500 bg-emerald-50 text-emerald-700',
  borderline: 'border-amber-500 bg-amber-50 text-amber-700',
  no: 'border-red-500 bg-red-50 text-red-700',
}

const whenLabel = formatDateTimeIST

export default function Cockpit({ data }: { data: CockpitData }) {
  const router = useRouter()
  const { interview, dossier, intake, questions, rubrics } = data

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
              <DossierPane dossier={dossier} intake={intake} />
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
// Non-gating context (informational criteria) followed by the raw intake answers.
function DossierPane({ dossier, intake }: { dossier: CriterionResult[]; intake: IntakeGroup[] }) {
  if (dossier.length === 0 && intake.length === 0) {
    return <p className="text-xs text-zinc-400">No challenge decision snapshot or intake on file for this candidate.</p>
  }
  const shown = dossier.filter((c) => !c.disabled)
  const info = shown.filter((c) => c.informational)
  const neutral = shown.filter((c) => !c.informational && c.status === 'na' && !c.undetermined)

  return (
    <div className="space-y-5">
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

      {/* Raw challenge-intake answers (stacked label → value for long free text). */}
      {intake.map((g, gi) => (
        <section key={g.group} className={dossier.length > 0 || gi > 0 ? 'border-t border-zinc-100 pt-4' : undefined}>
          <SectionLabel>{g.group}</SectionLabel>
          <div className="mt-2 space-y-2.5">
            {g.fields.map((f) => (
              <div key={f.label}>
                <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{f.label}</div>
                <p className={`whitespace-pre-wrap text-[12px] leading-snug ${f.value === '—' ? 'text-zinc-300' : 'text-zinc-700'}`}>{f.value}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
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
      {question.section && (
        <div className="mb-1.5 inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {question.section}
        </div>
      )}
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

// Weak → strong tone for a selected score button + a level chip.
const TONE_SOLID: Record<string, string> = {
  red: 'bg-red-600 text-white',
  amber: 'bg-amber-500 text-white',
  orange: 'bg-orange-500 text-white',
  emerald: 'bg-emerald-600 text-white',
}
const TONE_CHIP: Record<string, string> = {
  red: 'bg-red-100 text-red-700',
  amber: 'bg-amber-100 text-amber-700',
  orange: 'bg-orange-100 text-orange-700',
  emerald: 'bg-emerald-100 text-emerald-700',
}

// ── Rubric row: one button per level on this rubric's scale, with guidance ────
function RubricRow({ rubric, value, onPick }: { rubric: InterviewRubric; value: number | null; onPick: (s: number) => void }) {
  const [open, setOpen] = useState(false)
  const hasGuide = !!rubric.note?.trim() || rubric.levels.some((l) => l.lookingFor.trim() || l.example.trim())
  const selected = value != null ? rubric.levels.find((l) => l.score === value) : undefined

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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <span className="mr-1 hidden text-[10px] uppercase tracking-wide text-zinc-300 sm:inline">weak</span>
          {rubric.levels.map((lv) => {
            const active = value === lv.score
            return (
              <button
                key={lv.score}
                onClick={() => onPick(lv.score)}
                title={lv.descriptor || `Score ${formatScore(lv.score)}`}
                className={`h-8 min-w-8 rounded-md px-1.5 text-sm font-semibold transition-colors ${active ? TONE_SOLID[scoreTone(lv.score)] : 'border border-zinc-200 text-zinc-400 hover:bg-zinc-50'}`}
              >
                {formatScore(lv.score)}
              </button>
            )
          })}
          <span className="ml-1 hidden text-[10px] uppercase tracking-wide text-zinc-300 sm:inline">strong</span>
        </div>
      </div>

      {selected?.descriptor && <p className="mt-1 text-[11px] leading-snug text-zinc-500">{selected.descriptor}</p>}

      {open && (
        <div className="mt-2 space-y-2.5 rounded-lg bg-zinc-50 p-3">
          {rubric.note?.trim() && (
            <p className="text-[11px] leading-snug text-zinc-500"><span className="font-semibold text-zinc-600">How to assess: </span>{rubric.note}</p>
          )}
          {rubric.levels.map((lv) => (
            <div key={lv.score} className="flex gap-2">
              <span className={`flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[11px] font-bold ${TONE_CHIP[scoreTone(lv.score)]}`}>{formatScore(lv.score)}</span>
              <div className="min-w-0 text-[12px] leading-snug">
                <span className="font-medium text-zinc-700">{lv.descriptor || <span className="font-normal text-zinc-300">—</span>}</span>
                {lv.lookingFor.trim() && (
                  <p className="mt-0.5 text-[11px] text-zinc-500"><span className="text-zinc-400">Looking for: </span>{lv.lookingFor}</p>
                )}
                {lv.example.trim() && (
                  <p className="mt-0.5 whitespace-pre-wrap text-[11px] italic text-zinc-400">e.g. {lv.example}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
