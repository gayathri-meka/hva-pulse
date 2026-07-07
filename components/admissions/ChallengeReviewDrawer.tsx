'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { ChallengeReviewRow } from './ChallengeReviewTable'
import { REVIEW_DECISIONS_ENABLED, type CriterionResult, type CriterionGroup } from '@/lib/challengeReview'
import type { IntakeRaw } from '@/lib/challengeIntake'
import {
  setChallengeDecision,
  getLearnerTaskDetail,
  type LearnerQuestionThread,
} from '@/app/(protected)/admissions/challenge/actions'

// Criterion groups, in display order.
const GROUPS: { key: CriterionGroup; label: string }[] = [
  { key: 'need', label: 'Need' },
  { key: 'work_availability', label: 'Work & Availability' },
  { key: 'engagement', label: 'Engagement' },
]

// SensAI task IDs (course 587) whose answers we surface on demand.
const COMMITMENT_TASK_IDS = ['8649']              // Day 3 — Commitment & Availability
const SES_TASK_IDS = ['8632', '8679']             // Day 5 Personal & Family Background + Day 6 Family Income

// Light decoding of the option-letter answers so the raw section reads plainly.
const DECODE: Record<string, Record<string, string>> = {
  studying_raw: { a: 'Yes', b: 'No' },
  level_raw: { a: 'Class 12', b: "Bachelor's", c: "Master's", d: 'Diploma', e: 'Other', f: 'Not applicable' },
  work_domain_raw: { a: 'Tech', b: 'Non-tech', c: 'Not applicable' },
  willing_raw: { a: 'Yes', b: 'No', c: 'Not sure', d: 'Not applicable' },
}
// Each raw answer is tagged with the criterion group it supports, so it renders
// right under that group's verdicts.
const INTAKE_FIELDS: { key: keyof IntakeRaw; label: string; group: CriterionGroup }[] = [
  { key: 'college_name', label: 'Current college', group: 'need' },
  { key: 'family_income_raw', label: 'Annual family income', group: 'need' },
  { key: 'family_size_raw', label: 'Family size', group: 'need' },
  { key: 'studying_raw', label: 'Currently studying', group: 'work_availability' },
  { key: 'level_raw', label: 'Education level', group: 'work_availability' },
  { key: 'grad_year_raw', label: 'Completion year', group: 'work_availability' },
  { key: 'work_domain_raw', label: 'Work domain', group: 'work_availability' },
  { key: 'salary_raw', label: 'Monthly salary', group: 'work_availability' },
  { key: 'willing_raw', label: 'Willing to leave work', group: 'work_availability' },
]
function decode(key: keyof IntakeRaw, raw: string): string {
  const map = DECODE[key as string]
  const norm = raw.trim().toLowerCase().replace(/[.]+$/, '')
  if (map && map[norm]) return `${map[norm]}`
  return raw
}

// The raw intake answers that support a given criterion group — rendered right
// under that group's verdicts as supporting evidence.
function GroupAnswers({ intake, group }: { intake: IntakeRaw | null; group: CriterionGroup }) {
  if (!intake) return null
  const rows = INTAKE_FIELDS.filter((f) => f.group === group)
    .map((f) => ({ ...f, raw: (intake[f.key] ?? '').toString().trim() }))
    .filter((r) => r.raw)
  if (!rows.length) return null
  return (
    <dl className="mt-2 divide-y divide-zinc-100 rounded-lg border border-zinc-100 bg-zinc-50/50">
      {rows.map((r) => (
        <div key={r.key as string} className="flex items-start justify-between gap-3 px-3 py-1.5">
          <dt className="text-xs text-zinc-500">{r.label}</dt>
          <dd className="max-w-[60%] text-right text-xs font-medium text-zinc-800">{decode(r.key, r.raw)}</dd>
        </div>
      ))}
    </dl>
  )
}

function StatusDot({ status }: { status: CriterionResult['status'] }) {
  const cls =
    status === 'pass' ? 'bg-emerald-500' : status === 'fail' ? 'bg-red-500' : 'bg-zinc-300'
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cls}`} />
}

// Collapsible viewer for a candidate's answers to one or more SensAI tasks —
// lazy-loaded from BigQuery on first expand (no pre-sync needed). Used for the
// Commitment & Availability set and the SES / family-background set.
function TaskAnswers({ email, taskIds, label }: { email: string; taskIds: string[]; label: string }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<LearnerQuestionThread[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && data === null && !loading) {
      setLoading(true)
      Promise.all(taskIds.map((t) => getLearnerTaskDetail(email, t)))
        .then((lists) => setData(lists.flat()))
        .catch(() => setError('Could not load answers from BigQuery.'))
        .finally(() => setLoading(false))
    }
  }

  const answered = data?.filter((q) => q.messages.some((m) => m.role === 'user' && m.content?.trim())) ?? []

  return (
    <div className="mt-3">
      <button
        onClick={toggle}
        className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 hover:text-zinc-700"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`}>
          <path fillRule="evenodd" d="M7.293 4.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414-1.414L11.586 10 7.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        {label}
      </button>
      {open && (
        <div className="mt-2">
          {loading && <p className="text-xs text-zinc-400">Loading from BigQuery…</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {data && answered.length === 0 && !loading && (
            <p className="text-xs text-zinc-400">No answers recorded.</p>
          )}
          {answered.length > 0 && (
            <ul className="space-y-2.5">
              {answered.map((q) => {
                const answer = [...q.messages].reverse().find((m) => m.role === 'user' && m.content?.trim())!.content!.trim()
                return (
                  <li key={q.questionId} className="rounded-lg border border-zinc-100 px-3 py-2">
                    <p className="whitespace-pre-line text-[11px] leading-snug text-zinc-500">{q.description.trim()}</p>
                    <p className="mt-1.5 text-sm font-medium text-zinc-900">{answer}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ChallengeReviewDrawer({
  row,
  cohortId,
  courseId,
  canReview,
  onClose,
}: {
  row: ChallengeReviewRow
  cohortId: number
  courseId: number
  canReview: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState(row.reason ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const systemLabel = row.systemDecision === 'selected' ? 'SELECT' : 'REJECT'
  const systemTone =
    row.systemDecision === 'selected'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-red-200 bg-red-50 text-red-800'

  function decide(decision: 'selected' | 'rejected') {
    setError(null)
    const overriding = decision !== row.systemDecision
    if (overriding && !reason.trim()) {
      setError('A reason is required when overriding the system recommendation.')
      return
    }
    startTransition(async () => {
      const res = await setChallengeDecision({
        email: row.email,
        cohortId,
        courseId,
        decision,
        reason: reason.trim() || undefined,
        systemDecision: row.systemDecision,
        criteriaSnapshot: row.criteria,
      })
      if (!res.ok) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">{row.name || row.email}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">{row.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l12 12M14 2L2 14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {row.systemChanged && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span aria-hidden>⚠</span>
              <span>
                The system now recommends <strong>{systemLabel}</strong>, which differs from the team&apos;s
                recorded verdict. The human decision stands — re-verify if the data has changed.
              </span>
            </div>
          )}

          {/* System recommendation */}
          <div className={`rounded-xl border px-4 py-3 ${systemTone}`}>
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">System recommends</div>
            <div className="mt-0.5 text-lg font-bold">{systemLabel}</div>
          </div>

          {/* Criteria checklist — grouped: Need, Work & Availability, Engagement. */}
          {GROUPS.map(({ key: group, label }) => {
            const items = row.criteria.filter((c) => c.group === group)
            if (!items.length) return null
            return (
              <div key={group} className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
                <ul className="space-y-2.5">
                  {items.map((c) => (
                    <li key={c.key} className="flex items-start gap-2.5">
                      <StatusDot status={c.status} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-zinc-800">
                            {c.label}
                            {c.placeholder && (
                              <span className="ml-1.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                placeholder
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              c.status === 'pass' ? 'text-emerald-700' : c.status === 'fail' ? 'text-red-600' : 'text-zinc-400'
                            }`}
                          >
                            {c.value}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400">Rule: {c.threshold}</div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Supporting raw answers for this group, right beside the verdicts. */}
                <GroupAnswers intake={row.intake} group={group} />

                {/* Full task answer sets, loaded on demand, under their group. */}
                {group === 'need' && (
                  <TaskAnswers email={row.email} taskIds={SES_TASK_IDS} label="SES / family background answers" />
                )}
                {group === 'work_availability' && (
                  <TaskAnswers email={row.email} taskIds={COMMITMENT_TASK_IDS} label="Commitment & availability answers" />
                )}
              </div>
            )
          })}

          {/* Current recorded decision */}
          {row.finalDecision && (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs text-zinc-600">
              <span className="font-semibold text-zinc-800">
                Verified: {row.finalDecision === 'selected' ? 'Selected' : 'Rejected'}
              </span>
              {row.overrodeSystem && <span className="ml-1.5 text-amber-600">(override)</span>}
              {row.decidedByName && <span> · {row.decidedByName}</span>}
              {row.decidedAt && <span> · {fmtDate(row.decidedAt)}</span>}
              {row.reason && <p className="mt-1 italic text-zinc-500">“{row.reason}”</p>}
            </div>
          )}
        </div>

        {/* Decision bar */}
        {canReview && (
          <div className="border-t border-zinc-100 px-5 py-4">
            {!REVIEW_DECISIONS_ENABLED && (
              <p className="mb-3 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-500">
                🔒 Decisions are locked until the team is ready. Buttons will enable then.
              </p>
            )}
            <label className="mb-1.5 block text-[11px] font-medium text-zinc-500">
              Reason (required to override the system)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              disabled={!REVIEW_DECISIONS_ENABLED}
              placeholder="Optional note; required if you disagree with the system…"
              className="mb-3 w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none disabled:bg-zinc-50 disabled:text-zinc-400"
            />
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                disabled={pending || !REVIEW_DECISIONS_ENABLED}
                onClick={() => decide('selected')}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:hover:bg-zinc-300"
              >
                ✓ Confirm Selected
              </button>
              <button
                disabled={pending || !REVIEW_DECISIONS_ENABLED}
                onClick={() => decide('rejected')}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:hover:bg-zinc-300"
              >
                ✗ Reject
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
