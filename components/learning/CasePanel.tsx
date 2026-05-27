'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  startCase,
  saveCaseStep1,
  clearCaseStep1,
  saveCaseStep2,
  saveCaseStep3,
  saveInterventions,
  updateDecisionDate,
  saveUpdate,
  closeCase,
  deleteCase,
  addInterventionComment,
  editInterventionComment,
  deleteInterventionComment,
  addStepComment,
  editStepComment,
  deleteStepComment,
  updateCaseSeverity,
  updateCaseAccountableTeam,
  removeCaseTrigger,
  attachCaseTrigger,
  type TriggerInput,
} from '@/app/(protected)/learning/actions'
import type { Observation } from './ObservationsModal'
import MetricTriggerPicker, { type MetricTriggerValue, MetricChartLoader } from './MetricTriggerPicker'

type StepKey = 'what_wrong' | 'why'

// ── Types ──────────────────────────────────────────────────────────────────────

export type InterventionComment = {
  id:        string
  by:        string
  by_name:   string | null
  at:        string
  text:      string
  edited_at: string | null
}

export type Intervention = {
  description:      string
  owner:            string
  due_date:         string | null
  completed_at:     string | null
  completion_notes: string | null
  comments?:        InterventionComment[]
}

export type UpdateLogEntry = {
  at:                      string
  by:                      string | null
  by_name:                 string | null
  note:                    string
  decision_date_pushed_to: string | null
}

// Trigger views as projected to the UI. Observations and metrics are joined
// in on the server so each row carries the human-readable snapshot it needs.
export type CaseTrigger =
  | {
      id:   string
      kind: 'observation'
      observation: {
        id:          string
        observed_at: string
        note:        string
        type:        string | null
        severity:    string | null
      } | null
    }
  | {
      id:                  string
      kind:                'metric'
      metric:              { id: string; name: string } | null
      metric_period_label: string | null
      metric_value:        number | null
    }

export type Case = {
  id:                    string
  learner_id:            string
  status:                'open' | 'in_progress' | 'follow_up'
  severity:              'Low' | 'Medium' | 'High' | null
  accountable_team:      'Program' | 'Learning' | null
  flagged_items:         string[]
  what_wrong_notes:      string | null
  what_wrong_comments:   InterventionComment[]
  root_cause_type:       'time' | 'learning' | 'both' | 'other' | null
  root_cause_categories: string[]
  root_cause_notes:      string | null
  why_comments:          InterventionComment[]
  step1_completed_at:    string | null
  step2_completed_at:    string | null
  step3_completed_at:    string | null
  interventions:         Intervention[]
  decision_date:         string | null
  last_reviewed_at:      string | null
  update_log:            UpdateLogEntry[]
  created_at:            string | null
  closed_at:             string | null
  outcome:               'resolved' | 'dropped' | 'other' | null
  outcome_note:          string | null
  triggers:              CaseTrigger[]
}

export type StaffUser = { id: string; name: string; role: string }

// Context about the learner this case belongs to, so the header strip can
// surface name / batch / LF / program status without a separate card above
// the case. All fields nullable — the panel falls back to "—" when unknown.
export type LearnerContext = {
  name:           string
  batch_name:     string | null
  new_batch:      string | null
  lf_name:        string | null
  new_lf:         string | null
  program_status: string | null
}

// Options surfaced in the "Link signals" picker inside Step 1.
export type MetricOption = { id: string; name: string }

interface Props {
  learnerId:             string
  cs:                    Case | null
  learner?:              LearnerContext
  staffUsers:            StaffUser[]
  categories:            string[]
  checklistItems:        string[]
  currentUserId:         string
  currentUserName:       string | null
  observationsForLearner?: Observation[]
  metricOptions?:          MetricOption[]
}

// ── Shared style helpers ───────────────────────────────────────────────────────

const primaryBtn = 'rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors'
const ghostBtn   = 'rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 hover:border-zinc-300 hover:text-zinc-800 transition-colors'
const inputCls   = 'w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1'
const labelCls   = 'mb-1 block text-xs font-medium text-zinc-600'

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  if (done) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5BAE5B]">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-white">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
      </span>
    )
  }
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
      active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-400'
    }`}>
      {n}
    </span>
  )
}

function ConfirmDialog({ title, message, confirmLabel, isPending, error, onConfirm, onCancel }: {
  title:        string
  message:      string
  confirmLabel: string
  isPending:    boolean
  error:        string
  onConfirm:    () => void
  onCancel:     () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500">{message}</p>
        {error && <p className="mt-2 text-xs text-[#E24B4A]">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={onConfirm} disabled={isPending} className={`${primaryBtn} bg-red-600 hover:bg-red-700`}>
            {isPending ? 'Deleting…' : confirmLabel}
          </button>
          <button onClick={onCancel} className={ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Header strip ───────────────────────────────────────────────────────────────

const SEVERITY_BADGE: Record<NonNullable<Case['severity']>, string> = {
  Low:    'bg-zinc-100 text-zinc-600',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
}

// Status label is derived the same way the Cases table does it: combining
// status + step completion + decision_date so the labels stay consistent
// across surfaces.
type DerivedStatus = 'Open' | 'Pending' | 'Monitoring' | 'Needs review' | 'Closed'

function deriveStatus(cs: Case): DerivedStatus {
  if (cs.closed_at) return 'Closed'
  const today = new Date().toISOString().slice(0, 10)
  const inMonitoring = !!cs.step3_completed_at
  if (inMonitoring && cs.decision_date && cs.decision_date <= today) return 'Needs review'
  if (inMonitoring)            return 'Monitoring'
  if (cs.step1_completed_at)   return 'Pending'
  return 'Open'
}

const STATUS_BADGE: Record<DerivedStatus, string> = {
  Open:           'bg-red-50 text-red-600 border border-red-200',
  Pending:        'bg-amber-50 text-amber-600 border border-amber-200',
  Monitoring:     'bg-blue-50 text-blue-600 border border-blue-200',
  'Needs review': 'bg-red-50 text-red-700 border-2 border-red-500',
  Closed:         'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

function daysBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const aMs = new Date(a).getTime()
  const bMs = new Date(b).getTime()
  if (Number.isNaN(aMs) || Number.isNaN(bMs)) return null
  return Math.max(0, Math.round((bMs - aMs) / (1000 * 60 * 60 * 24)))
}

// One "station" in the timeline strip: an outlined card with a small label
// and a larger date underneath. Looks like a chip you can read at a glance.
function TimelineStation({ label, date, tone = 'neutral', subtitle }: {
  label:    string
  date:     string | null
  tone?:    'neutral' | 'overdue' | 'muted'
  subtitle?: string | null
}) {
  // "overdue" tone is a red outline + red text so it pops without using a
  // heavy black fill that fights the rest of the panel.
  const toneCls = tone === 'overdue'
    ? 'border-red-300 bg-red-50 text-red-700'
    : tone === 'muted'
      ? 'border-dashed border-zinc-200 bg-zinc-50 text-zinc-400'
      : 'border-zinc-200 bg-white text-zinc-700'
  const labelCls = tone === 'overdue' ? 'text-red-500' : 'text-zinc-400'
  return (
    <div className={`flex min-w-[110px] flex-col rounded-lg border px-3 py-2 ${toneCls}`}>
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${labelCls}`}>
        {label}
      </span>
      <span className={`mt-0.5 text-sm font-semibold ${tone === 'muted' ? 'text-zinc-400' : ''}`}>
        {date ? fmtDate(date) : '—'}
      </span>
      {subtitle && (
        <span className={`mt-0.5 text-[10px] ${tone === 'overdue' ? 'text-red-500' : 'text-zinc-400'}`}>
          {subtitle}
        </span>
      )}
    </div>
  )
}

function TimelineArrow({ days }: { days: number | null }) {
  return (
    <div className="flex flex-col items-center justify-center px-1">
      {days !== null && (
        <span className="text-[10px] font-medium text-zinc-400">{days}d</span>
      )}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-4 w-4 text-zinc-300">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </div>
  )
}

const PROGRAM_STATUS_BADGE: Record<string, string> = {
  Ongoing:          'bg-emerald-100 text-emerald-700',
  'On Hold':        'bg-orange-100 text-orange-700',
  Dropout:          'bg-red-100 text-red-700',
  Discontinued:     'bg-zinc-200 text-zinc-600',
  'Placed - Self':  'bg-blue-100 text-blue-700',
  'Placed - HVA':   'bg-violet-100 text-violet-700',
}

function HeaderStrip({ cs, learner }: { cs: Case; learner?: LearnerContext }) {
  const [isPending, startTrans] = useTransition()
  const router = useRouter()
  const status = deriveStatus(cs)

  function setSeverity(value: Case['severity']) {
    startTrans(async () => {
      await updateCaseSeverity(cs.id, value)
      router.refresh()
    })
  }
  function setTeam(value: Case['accountable_team']) {
    startTrans(async () => {
      await updateCaseAccountableTeam(cs.id, value)
      router.refresh()
    })
  }

  // Days between each timeline station — only computed when both ends exist.
  const today = new Date().toISOString()
  const toDecision = daysBetween(cs.created_at, cs.decision_date)
  const toClose    = daysBetween(cs.decision_date, cs.closed_at)
  const decisionTone: 'overdue' | 'neutral' | 'muted' =
    cs.closed_at ? 'neutral'
    : cs.decision_date && cs.decision_date <= today.slice(0, 10) ? 'overdue'
    : cs.decision_date ? 'neutral'
    : 'muted'
  const decisionSubtitle =
    !cs.closed_at && cs.decision_date && cs.decision_date <= today.slice(0, 10)
      ? 'Needs review'
      : null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      {learner && (
        <div className="mb-3 border-b border-zinc-100 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-zinc-900">{learner.name}</p>
            {learner.program_status && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PROGRAM_STATUS_BADGE[learner.program_status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {learner.program_status}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            {(learner.batch_name || learner.new_batch) && (
              <span>
                <span className="text-zinc-400">Batch:</span>{' '}
                <span className="text-zinc-900">{learner.batch_name ?? '—'}</span>
                {learner.new_batch && learner.new_batch !== learner.batch_name && (
                  <span className="text-zinc-900"> → {learner.new_batch}</span>
                )}
              </span>
            )}
            {(learner.lf_name || learner.new_lf) && (
              <span>
                <span className="text-zinc-400">LF:</span>{' '}
                <span className="text-zinc-900">{learner.lf_name ?? '—'}</span>
                {learner.new_lf && learner.new_lf !== learner.lf_name && (
                  <span className="text-zinc-900"> → {learner.new_lf}</span>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
          {status}
        </span>

        {/* Severity */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          Severity
          <div className="relative">
            <select
              value={cs.severity ?? ''}
              onChange={(e) => setSeverity((e.target.value || null) as Case['severity'])}
              disabled={isPending}
              className="appearance-none rounded-lg border border-zinc-200 bg-white py-1 pl-2.5 pr-7 text-xs text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
            >
              <option value="">Not set</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-400">▾</span>
          </div>
          {cs.severity && (
            <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[cs.severity]}`}>
              {cs.severity}
            </span>
          )}
        </label>

        {/* Accountable team */}
        <label className="flex items-center gap-1.5 text-xs text-zinc-500">
          Accountable team
          <div className="relative">
            <select
              value={cs.accountable_team ?? ''}
              onChange={(e) => setTeam((e.target.value || null) as Case['accountable_team'])}
              disabled={isPending}
              className="appearance-none rounded-lg border border-zinc-200 bg-white py-1 pl-2.5 pr-7 text-xs text-zinc-700 shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
            >
              <option value="">Not set</option>
              <option value="Program">Program</option>
              <option value="Learning">Learning</option>
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-zinc-400">▾</span>
          </div>
        </label>
      </div>

      {/* Timeline — three chips with day-deltas between */}
      <div className="mt-4 flex flex-wrap items-stretch gap-1">
        <TimelineStation label="Created" date={cs.created_at} tone="neutral" />
        <TimelineArrow days={toDecision} />
        <TimelineStation
          label="Decision"
          date={cs.decision_date}
          tone={decisionTone}
          subtitle={decisionSubtitle}
        />
        <TimelineArrow days={toClose} />
        <TimelineStation
          label="Closed"
          date={cs.closed_at}
          tone={cs.closed_at ? 'neutral' : 'muted'}
        />
      </div>
    </div>
  )
}

// ── Linked-signals helpers (used inside Step 1) ────────────────────────────────

function TriggerRow({ t, learnerId, onRemove, busy }: {
  t:         CaseTrigger
  learnerId: string
  onRemove:  () => void
  busy:      boolean
}) {
  // Metric chart is heavy (one fetch per row), so default it to collapsed.
  const [chartOpen, setChartOpen] = useState(false)

  return (
    <li className="rounded-lg bg-zinc-50 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        {t.kind === 'observation' ? (
          <div className="min-w-0 text-xs">
            <div className="text-zinc-500">
              <span className="font-medium text-zinc-800">Observation</span>
              {t.observation && <> · {fmtDate(t.observation.observed_at)}</>}
              {t.observation?.type && <> · {t.observation.type}</>}
              {t.observation?.severity && <> · severity {t.observation.severity}</>}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-zinc-700">
              {t.observation?.note ?? <span className="text-zinc-400">(observation deleted)</span>}
            </p>
          </div>
        ) : (
          <div className="min-w-0 text-xs">
            <div className="text-zinc-500">
              <span className="font-medium text-zinc-800">Metric</span>
              {t.metric_period_label && <> · {t.metric_period_label}</>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="text-zinc-700">
                {t.metric?.name ?? <span className="text-zinc-400">(metric deleted)</span>}
                {t.metric_value !== null && (
                  <span className="ml-1 text-zinc-500">= {t.metric_value}</span>
                )}
              </span>
              {t.metric && (
                <button
                  onClick={() => setChartOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] text-zinc-600 hover:border-zinc-300 hover:text-zinc-800"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className={`h-3 w-3 transition-transform ${chartOpen ? 'rotate-90' : ''}`}
                  >
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                  </svg>
                  {chartOpen ? 'Hide chart' : 'Show chart'}
                </button>
              )}
            </div>
          </div>
        )}
        <button
          onClick={onRemove}
          disabled={busy}
          className="shrink-0 text-xs text-zinc-400 hover:text-red-600 disabled:opacity-40"
          title="Remove signal"
        >
          Remove
        </button>
      </div>

      {/* Chart only mounts when expanded — keeps the page light and only fires
          the server fetch when the user actually wants to see the trend. */}
      {t.kind === 'metric' && t.metric && chartOpen && (
        <div className="mt-2 rounded-md border border-zinc-100 bg-white p-2">
          <MetricChartLoader learnerId={learnerId} metricId={t.metric.id} />
        </div>
      )}
    </li>
  )
}

// Inline picker dialog rendered inside Step1Card. Lets staff attach
// additional observation/metric triggers to an existing case.
function LinkSignalsDialog({
  caseId,
  learnerId,
  alreadyLinkedObservationIds,
  alreadyLinkedMetricIds,
  observationsForLearner,
  metricOptions,
  onClose,
}: {
  caseId:                      string
  learnerId:                   string
  alreadyLinkedObservationIds: Set<string>
  alreadyLinkedMetricIds:      Set<string>
  observationsForLearner:      Observation[]
  metricOptions:               MetricOption[]
  onClose:                     () => void
}) {
  const router = useRouter()
  const [isPending, startTrans]     = useTransition()
  const [error, setError]           = useState('')
  const [obsChecked, setObsChecked]     = useState<Set<string>>(new Set())
  const [metricPicks, setMetricPicks]   = useState<MetricTriggerValue[]>([])

  // Hide already-linked signals from the picker so we don't try to create
  // duplicate trigger rows.
  const candidateObservations = observationsForLearner.filter((o) => !alreadyLinkedObservationIds.has(o.id))
  const candidateMetrics      = metricOptions.filter((m) => !alreadyLinkedMetricIds.has(m.id))

  function toggleObs(id: string) {
    setObsChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleAttach() {
    const toAttach: TriggerInput[] = []
    for (const obsId of obsChecked) toAttach.push({ kind: 'observation', observation_id: obsId })
    for (const m of metricPicks) {
      toAttach.push({
        kind:                'metric',
        metric_id:           m.metric_id,
        metric_period_label: m.metric_period_label,
        metric_value:        m.metric_value,
      })
    }
    if (toAttach.length === 0) { setError('Pick at least one observation or metric'); return }
    setError('')
    startTrans(async () => {
      try {
        for (const t of toAttach) await attachCaseTrigger(caseId, t)
        router.refresh()
        onClose()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-12">
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-zinc-900">Link observations / metrics</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Observations */}
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Observations</p>
            {candidateObservations.length === 0 ? (
              <p className="text-xs text-zinc-400">
                {observationsForLearner.length === 0
                  ? 'No observations recorded for this learner yet.'
                  : 'All recent observations are already linked.'}
              </p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-y-auto">
                {candidateObservations.slice(0, 20).map((o) => (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300 accent-zinc-900"
                        checked={obsChecked.has(o.id)}
                        onChange={() => toggleObs(o.id)}
                      />
                      <span className="min-w-0 flex-1 text-xs">
                        <span className="text-zinc-500">{fmtDate(o.observed_at)}</span>
                        {o.type && <span className="ml-1.5 text-zinc-500">· {o.type}</span>}
                        {o.severity && <span className="ml-1.5 text-zinc-500">· severity {o.severity}</span>}
                        <span className="mt-0.5 block whitespace-pre-wrap text-zinc-700">{o.note}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Metric snapshot */}
          <div className="rounded-lg border border-zinc-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Metric snapshot</p>
            <MetricTriggerPicker
              learnerId={learnerId}
              metricOptions={candidateMetrics}
              value={metricPicks}
              onChange={setMetricPicks}
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className={ghostBtn}>Cancel</button>
          <button onClick={handleAttach} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Attaching…' : 'Attach'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel ──────────────────────────────────────────────────────────────────────

export default function CasePanel({ learnerId, cs, learner, staffUsers, categories, checklistItems, currentUserId, currentUserName, observationsForLearner = [], metricOptions = [] }: Props) {
  const router = useRouter()
  const [isDeleting, startDelete] = useTransition()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const step1Done = !!cs?.step1_completed_at
  const step2Done = !!cs?.step2_completed_at
  const step3Done = !!cs?.step3_completed_at

  function handleDeleteCase() {
    if (!cs) return
    setDeleteError('')
    startDelete(async () => {
      try {
        await deleteCase(cs.id)
        setShowDeleteConfirm(false)
        router.refresh()
      } catch (e) {
        setDeleteError(String(e))
      }
    })
  }

  return (
    <div>
      <div className="mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Case</p>
      </div>
      {cs && (
        <div className="mb-4">
          <HeaderStrip cs={cs} learner={learner} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Step1Card
          learnerId={learnerId}
          cs={cs}
          checklistItems={checklistItems}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          observationsForLearner={observationsForLearner}
          metricOptions={metricOptions}
        />
        <Step2Card cs={cs} locked={!step1Done} categories={categories} currentUserId={currentUserId} currentUserName={currentUserName} />
        <Step3Card cs={cs} locked={!step2Done} staffUsers={staffUsers} currentUserId={currentUserId} currentUserName={currentUserName} />
        <Step4Card cs={cs} locked={!step3Done} />
      </div>

      {cs && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:border-red-300 hover:bg-red-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
            Delete case
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Delete case?"
          message="All progress, notes, and interventions for this case will be permanently removed. This cannot be undone."
          confirmLabel="Delete case"
          isPending={isDeleting}
          error={deleteError}
          onConfirm={handleDeleteCase}
          onCancel={() => { setShowDeleteConfirm(false); setDeleteError('') }}
        />
      )}
    </div>
  )
}

// ── Step 1: What's wrong? ──────────────────────────────────────────────────────

function Step1Card({
  learnerId,
  cs,
  checklistItems,
  currentUserId,
  currentUserName,
  observationsForLearner,
  metricOptions,
}: {
  learnerId:              string
  cs:                     Case | null
  checklistItems:         string[]
  currentUserId:          string
  currentUserName:        string | null
  observationsForLearner: Observation[]
  metricOptions:          MetricOption[]
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const complete = !!cs?.step1_completed_at
  const [editing, setEditing] = useState(!complete)
  const [flagged, setFlagged] = useState<string[]>(cs?.flagged_items ?? [])
  const [notes,   setNotes]   = useState(cs?.what_wrong_notes ?? '')
  const [error,   setError]   = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments,     setComments]     = useState<InterventionComment[]>(cs?.what_wrong_comments ?? [])
  const [showLinkPicker, setShowLinkPicker] = useState(false)
  const [isRemovingTrigger, startRemoveTrigger] = useTransition()

  const triggers = cs?.triggers ?? []
  const linkedObsIds = new Set(
    triggers
      .filter((t): t is Extract<CaseTrigger, { kind: 'observation' }> => t.kind === 'observation')
      .map((t) => t.observation?.id)
      .filter((id): id is string => !!id),
  )
  const linkedMetricIds = new Set(
    triggers
      .filter((t): t is Extract<CaseTrigger, { kind: 'metric' }> => t.kind === 'metric')
      .map((t) => t.metric?.id)
      .filter((id): id is string => !!id),
  )

  function removeTrigger(id: string) {
    if (!window.confirm('Remove this signal?')) return
    startRemoveTrigger(async () => {
      await removeCaseTrigger(id)
      router.refresh()
    })
  }

  function toggleItem(item: string) {
    setFlagged((prev) =>
      prev.includes(item) ? prev.filter((f) => f !== item) : [...prev, item]
    )
  }

  function handleStart() {
    startTrans(async () => {
      try { await startCase(learnerId); router.refresh() }
      catch (e) { setError(String(e)) }
    })
  }

  function handleSave() {
    if (flagged.length === 0 && !notes.trim()) {
      setError('Select at least one item or add a note')
      return
    }
    if (!cs) return
    startTrans(async () => {
      try {
        await saveCaseStep1(cs.id, {
          flagged_items:    flagged,
          what_wrong_notes: notes,
        })
        setEditing(false)
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StepBadge n={1} done={complete} active={!complete} />
          <span className="text-sm font-semibold text-zinc-900">What&apos;s wrong?</span>
        </div>
        {cs && (
          <CommentToggleButton count={comments.length} onClick={() => setCommentsOpen((v) => !v)} />
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        Describe the concern and link the observations or metrics that prompted this case.
      </p>

      {/* Linked signals — only visible when there's an active case */}
      {cs && (
        <div className="mb-3 rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Linked signals <span className="font-normal text-zinc-400">({triggers.length})</span>
            </p>
            <button
              onClick={() => setShowLinkPicker(true)}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
              </svg>
              Link observation / metric
            </button>
          </div>
          {triggers.length === 0 ? (
            <p className="text-xs text-zinc-400">
              No signals linked yet. Click <span className="font-medium text-zinc-600">Link</span> to pick the observations or metrics that anchor this case.
            </p>
          ) : (
            <ul className="space-y-2">
              {triggers.map((t) => (
                <TriggerRow
                  key={t.id}
                  t={t}
                  learnerId={learnerId}
                  onRemove={() => removeTrigger(t.id)}
                  busy={isRemovingTrigger}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {!cs && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">No active case for this learner.</p>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          <button onClick={handleStart} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Starting…' : 'Start case'}
          </button>
        </div>
      )}

      {showLinkPicker && cs && (
        <LinkSignalsDialog
          caseId={cs.id}
          learnerId={learnerId}
          alreadyLinkedObservationIds={linkedObsIds}
          alreadyLinkedMetricIds={linkedMetricIds}
          observationsForLearner={observationsForLearner}
          metricOptions={metricOptions}
          onClose={() => setShowLinkPicker(false)}
        />
      )}

      {cs && editing && (
        <div className="space-y-3">
          {checklistItems.length > 0 && (
            <div>
              <label className={labelCls}>Flag the signals that are off</label>
              <div className="space-y-1.5 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                {checklistItems.map((item) => (
                  <label key={item} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={flagged.includes(item)}
                      onChange={() => toggleItem(item)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                    />
                    <span className="text-sm text-zinc-700">{item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Additional notes</label>
            <textarea
              className={`${inputCls} min-h-[72px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other observations…"
            />
          </div>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
              {isPending ? 'Saving…' : complete ? 'Save' : 'Save and continue'}
            </button>
            {complete && (
              <button onClick={() => { setEditing(false); setError('') }} className={ghostBtn}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {cs && !editing && (
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {flagged.length > 0 && (
                <ul className="space-y-0.5">
                  {flagged.map((f) => (
                    <li key={f} className="flex items-center gap-1.5 text-sm text-zinc-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}
              {notes && (
                <p className="mt-1.5 text-xs text-zinc-500">{notes}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button onClick={() => setEditing(true)} className="text-xs text-zinc-400 hover:text-zinc-600">
                Edit
              </button>
              <button onClick={() => setShowClearConfirm(true)} className="text-xs text-red-400 hover:text-red-600">
                Delete
              </button>
            </div>
          </div>
          {error && <p className="mt-1 text-xs text-[#E24B4A]">{error}</p>}
        </div>
      )}

      {cs && commentsOpen && (
        <CommentsThread
          comments={comments}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onAdd={(c) => addStepComment(cs.id, 'what_wrong', c)}
          onEdit={(cid, text) => editStepComment(cs.id, 'what_wrong', cid, text)}
          onDelete={(cid) => deleteStepComment(cs.id, 'what_wrong', cid)}
          onCommentsChange={setComments}
        />
      )}

      {showClearConfirm && cs && (
        <ConfirmDialog
          title="Delete 'What's wrong?' data?"
          message="The flagged items and notes for this step will be cleared. You can re-enter them anytime."
          confirmLabel="Delete"
          isPending={isPending}
          error={error}
          onConfirm={() => {
            startTrans(async () => {
              try {
                await clearCaseStep1(cs.id)
                setFlagged([])
                setNotes('')
                setShowClearConfirm(false)
                setError('')
                router.refresh()
              } catch (e) { setError(String(e)) }
            })
          }}
          onCancel={() => { setShowClearConfirm(false); setError('') }}
        />
      )}
    </div>
  )
}

// ── Step 2: Why? ───────────────────────────────────────────────────────────────

function Step2Card({
  cs,
  locked,
  categories,
  currentUserId,
  currentUserName,
}: {
  cs:    Case | null
  locked:          boolean
  categories:      string[]
  currentUserId:   string
  currentUserName: string | null
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const complete = !!cs?.step2_completed_at
  const [editing,    setEditing]    = useState(!complete)
  const [rcType,     setRcType]     = useState<'time' | 'learning' | 'other' | ''>(
    cs?.root_cause_type === 'both' ? '' : (cs?.root_cause_type ?? '')
  )
  const [selected,   setSelected]   = useState<string[]>(cs?.root_cause_categories ?? [])
  const [notes,      setNotes]      = useState(cs?.root_cause_notes ?? '')
  const [error,      setError]      = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [comments,     setComments]     = useState<InterventionComment[]>(cs?.why_comments ?? [])

  function toggleCategory(cat: string) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={2} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">Why?</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 1 first.</p>
      </div>
    )
  }

  function handleSave() {
    if (!rcType) { setError('Pick a root cause category'); return }
    if (selected.length === 0 && !notes.trim()) { setError('Select at least one category or add a note'); return }
    if (!cs) return
    startTrans(async () => {
      try {
        await saveCaseStep2(cs.id, {
          root_cause_type:       rcType,
          root_cause_categories: selected,
          root_cause_notes:      notes,
        })
        setEditing(false)
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StepBadge n={2} done={complete} active={!complete} />
          <span className="text-sm font-semibold text-zinc-900">Why?</span>
        </div>
        {cs && (
          <CommentToggleButton count={comments.length} onClick={() => setCommentsOpen((v) => !v)} />
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        Identify the root cause behind what&apos;s wrong.
      </p>

      {cs && editing && (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Category</label>
            <select
              className={inputCls}
              value={rcType}
              onChange={(e) => setRcType(e.target.value as 'time' | 'learning' | 'other' | '')}
            >
              <option value="">Select a category…</option>
              <option value="time">Time</option>
              <option value="learning">Learning</option>
              <option value="other">Other</option>
            </select>
          </div>
          {categories.length > 0 && (
            <div>
              <label className={labelCls}>Root cause categories</label>
              <div className="space-y-1.5 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                {categories.map((cat) => (
                  <label key={cat} className="flex cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={selected.includes(cat)}
                      onChange={() => toggleCategory(cat)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                    />
                    <span className="text-sm text-zinc-700">{cat}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={`${inputCls} min-h-[80px] resize-y`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's driving the issue?"
            />
          </div>
          {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={isPending} className={primaryBtn}>
              {isPending ? 'Saving…' : complete ? 'Save' : 'Save and continue'}
            </button>
            {complete && (
              <button onClick={() => { setEditing(false); setError('') }} className={ghostBtn}>Cancel</button>
            )}
          </div>
        </div>
      )}

      {cs && !editing && (
        <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {rcType && (
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {rcType === 'time'     ? 'Time'
                  : rcType === 'learning' ? 'Learning'
                  :                         'Other'}
                </p>
              )}
              {selected.length > 0 && (
                <ul className="space-y-0.5">
                  {selected.map((cat) => (
                    <li key={cat} className="flex items-center gap-1.5 text-sm text-zinc-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      {cat}
                    </li>
                  ))}
                </ul>
              )}
              {notes && (
                <p className="mt-1.5 text-xs text-zinc-500">{notes}</p>
              )}
            </div>
            <button onClick={() => setEditing(true)} className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600">
              Edit
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-[#E24B4A]">{error}</p>}
        </div>
      )}

      {cs && commentsOpen && (
        <CommentsThread
          comments={comments}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onAdd={(c) => addStepComment(cs.id, 'why', c)}
          onEdit={(cid, text) => editStepComment(cs.id, 'why', cid, text)}
          onDelete={(cid) => deleteStepComment(cs.id, 'why', cid)}
          onCommentsChange={setComments}
        />
      )}
    </div>
  )
}

// ── Step 3: What next? ─────────────────────────────────────────────────────────

function Step3Card({
  cs,
  locked,
  staffUsers,
  currentUserId,
  currentUserName,
}: {
  cs:    Case | null
  locked:          boolean
  staffUsers:      StaffUser[]
  currentUserId:   string
  currentUserName: string | null
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const complete = !!cs?.step3_completed_at
  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])

  const initItems = (): Intervention[] => {
    if (cs?.interventions?.length) {
      return cs.interventions.map((ai) => ({
        ...ai,
        completed_at: (ai as Intervention).completed_at ?? null,
      }))
    }
    return [{ description: '', owner: '', due_date: '', completed_at: null, completion_notes: null }]
  }

  const [items, setItems]         = useState<Intervention[]>(initItems)
  const [setupError, setSetupErr] = useState('')

  useEffect(() => {
    if (!cs?.interventions?.length) {
      setItems((prev) => prev.map((it) => it.due_date ? it : { ...it, due_date: defaultDueDate() }))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [editingIdx,    setEditingIdx]    = useState<number | null>(null)
  const [deletingIdx,   setDeletingIdx]   = useState<number | null>(null)
  const [deleteError,   setDeleteError]   = useState('')
  const [editDraft,     setEditDraft]     = useState<Intervention>({ description: '', owner: '', due_date: '', completed_at: null, completion_notes: null })
  const [editError,     setEditError]     = useState('')
  const [completingIdx,   setCompletingIdx]   = useState<number | null>(null)
  const [completionDate,  setCompletionDate]  = useState('')
  const [completionNotes, setCompletionNotes] = useState('')
  const [editingNotesIdx, setEditingNotesIdx] = useState<number | null>(null)
  const [notesDraft,      setNotesDraft]      = useState('')
  const [openThreads,     setOpenThreads]     = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!locked && !complete && !cs?.interventions?.length) {
      setItems([{ description: '', owner: '', due_date: defaultDueDate(), completed_at: null, completion_notes: null }])
    }
  }, [locked, complete, cs?.interventions?.length])

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={3} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">What next?</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 2 first.</p>
      </div>
    )
  }

  async function persistItems(updated: Intervention[]) {
    if (!cs) return
    if (complete) {
      await saveInterventions(cs.id, updated)
    } else {
      await saveCaseStep3(cs.id, updated)
    }
  }

  function addSetupItem() {
    setItems((prev) => [...prev, { description: '', owner: '', due_date: defaultDueDate(), completed_at: null, completion_notes: null }])
  }

  function removeSetupItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateSetupItem(i: number, field: keyof Intervention, val: string | null) {
    setItems((prev) =>
      prev.map((item, idx) => (idx === i ? { ...item, [field]: val } : item))
    )
  }

  function handleSetupSave() {
    if (!cs) return
    const valid = items.filter((item) => item.description.trim() && item.owner.trim() && item.due_date)
    if (valid.length === 0) { setSetupErr('Add at least one complete action item'); return }
    const incomplete = items.findIndex((item) => item.description.trim() && (!item.owner.trim() || !item.due_date))
    if (incomplete >= 0) { setSetupErr('Owner and due date are required for each item'); return }
    startTrans(async () => {
      try {
        const toSave = items.filter((item) => item.description.trim())
        await saveCaseStep3(cs.id, toSave)
        setSetupErr('')
        router.refresh()
      } catch (e) { setSetupErr(String(e)) }
    })
  }

  function startEdit(i: number) {
    setEditingIdx(i)
    setEditDraft({ ...items[i] })
    setEditError('')
  }

  function startAddItem() {
    setEditingIdx(-1)
    setEditDraft({ description: '', owner: '', due_date: defaultDueDate(), completed_at: null, completion_notes: null })
    setEditError('')
  }

  function handleItemSave() {
    if (!editDraft.description.trim()) { setEditError('Description is required'); return }
    if (!editDraft.owner.trim())       { setEditError('Owner is required'); return }
    if (!editDraft.due_date)           { setEditError('Due date is required'); return }
    startTrans(async () => {
      try {
        let updated: Intervention[]
        if (editingIdx === -1) {
          updated = [...items, { ...editDraft }]
        } else {
          updated = items.map((item, i) => (i === editingIdx ? { ...editDraft } : item))
        }
        await persistItems(updated)
        setItems(updated)
        setEditingIdx(null)
        setEditError('')
        router.refresh()
      } catch (e) { setEditError(String(e)) }
    })
  }

  function handleCheckbox(i: number) {
    if (items[i].completed_at) {
      startTrans(async () => {
        try {
          const updated = items.map((item, idx) => idx === i ? { ...item, completed_at: null, completion_notes: null } : item)
          await persistItems(updated)
          setItems(updated)
          router.refresh()
        } catch {}
      })
    } else {
      setCompletingIdx(i)
      setCompletionDate(today)
      setCompletionNotes('')
    }
  }

  function confirmDone() {
    if (completingIdx === null) return
    startTrans(async () => {
      try {
        const updated = items.map((item, idx) =>
          idx === completingIdx
            ? { ...item, completed_at: completionDate, completion_notes: completionNotes.trim() || null }
            : item
        )
        await persistItems(updated)
        setItems(updated)
        setCompletingIdx(null)
        setCompletionNotes('')
        router.refresh()
      } catch {}
    })
  }

  function saveNotes(i: number) {
    startTrans(async () => {
      try {
        const updated = items.map((item, idx) =>
          idx === i ? { ...item, completion_notes: notesDraft.trim() || null } : item
        )
        await persistItems(updated)
        setItems(updated)
        setEditingNotesIdx(null)
        setNotesDraft('')
        router.refresh()
      } catch {}
    })
  }

  // ── Setup form (before step3 complete) ───────────────────────────────────────
  if (!complete) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-1 flex items-center gap-2">
          <StepBadge n={3} done={false} active />
          <span className="text-sm font-semibold text-zinc-900">What next?</span>
        </div>
        <p className="mb-3 text-xs text-zinc-500">
          List the interventions we&apos;re taking on this case.
        </p>

        <div className="space-y-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          {items.map((item, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <input
                  className={`${inputCls} flex-1`}
                  placeholder="Description *"
                  value={item.description}
                  onChange={(e) => updateSetupItem(i, 'description', e.target.value)}
                />
                {items.length > 1 && (
                  <button onClick={() => removeSetupItem(i)} className="shrink-0 text-zinc-300 hover:text-red-500">×</button>
                )}
              </div>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={item.owner}
                  onChange={(e) => updateSetupItem(i, 'owner', e.target.value)}
                >
                  <option value="">Owner *</option>
                  {staffUsers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="date"
                className={inputCls}
                value={item.due_date ?? ''}
                onChange={(e) => updateSetupItem(i, 'due_date', e.target.value || null)}
              />
            </div>
          ))}

          {setupError && <p className="text-xs text-[#E24B4A]">{setupError}</p>}

          <button onClick={handleSetupSave} disabled={isPending} className={primaryBtn}>
            {isPending ? 'Saving…' : 'Save and continue'}
          </button>
        </div>

        <button
          onClick={addSetupItem}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          <span>+</span> Add item
        </button>
      </div>
    )
  }

  // ── Complete: per-item view ───────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <StepBadge n={3} done={complete} active={!complete} />
        <span className="text-sm font-semibold text-zinc-900">What next?</span>
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        List the interventions we&apos;re taking on this case.
      </p>

      <div className="space-y-2">
        {items.map((item, i) => {
          const isEditing    = editingIdx === i
          const isCompleting = completingIdx === i

          if (isEditing) {
            return (
              <div key={i} className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
                <input
                  className={inputCls}
                  placeholder="Description *"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                />
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    value={editDraft.owner}
                    onChange={(e) => setEditDraft((d) => ({ ...d, owner: e.target.value }))}
                  >
                    <option value="">Owner *</option>
                    {staffUsers.map((s) => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="date"
                  className={inputCls}
                  value={editDraft.due_date ?? ''}
                  onChange={(e) => setEditDraft((d) => ({ ...d, due_date: e.target.value || null }))}
                />
                {editError && <p className="text-xs text-[#E24B4A]">{editError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleItemSave} disabled={isPending} className={primaryBtn}>
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setEditingIdx(null); setEditError('') }} className={ghostBtn}>
                    Cancel
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-start gap-2.5 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <input
                  type="checkbox"
                  checked={!!item.completed_at}
                  onChange={() => handleCheckbox(i)}
                  disabled={isPending}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-zinc-300 accent-[#5BAE5B]"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${item.completed_at ? 'text-zinc-400 line-through' : 'font-medium text-zinc-800'}`}>
                    {item.description}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-400">
                    {item.owner    && <span>{item.owner}</span>}
                    {item.due_date && <span>Due {fmtDate(item.due_date)}</span>}
                    {item.completed_at && <span className="text-[#5BAE5B]">Done {fmtDate(item.completed_at)}</span>}
                  </div>
                  {item.completed_at && (
                    editingNotesIdx === i ? (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">Completion notes</p>
                        <textarea
                          autoFocus
                          rows={3}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="What was done?"
                          className="w-full resize-y rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => saveNotes(i)} disabled={isPending} className={primaryBtn}>
                            {isPending ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => { setEditingNotesIdx(null); setNotesDraft('') }} className={ghostBtn}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : item.completion_notes ? (
                      <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                              Completion notes
                              {item.completed_at && (
                                <span className="ml-2 font-normal normal-cs tracking-normal text-emerald-600/70">· {fmtDate(item.completed_at)}</span>
                              )}
                            </p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700">{item.completion_notes}</p>
                          </div>
                          <button
                            onClick={() => { setEditingNotesIdx(i); setNotesDraft(item.completion_notes ?? '') }}
                            className="shrink-0 text-xs text-emerald-700 hover:text-emerald-900"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingNotesIdx(i); setNotesDraft('') }}
                        className="mt-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                      >
                        + Add completion notes
                      </button>
                    )
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <CommentToggleButton
                    count={(item.comments ?? []).length}
                    onClick={() => {
                      setOpenThreads((prev) => {
                        const next = new Set(prev)
                        if (next.has(i)) next.delete(i)
                        else              next.add(i)
                        return next
                      })
                    }}
                  />
                  <button onClick={() => startEdit(i)} className="text-xs text-zinc-400 hover:text-zinc-600">
                    Edit
                  </button>
                  <button onClick={() => { setDeletingIdx(i); setDeleteError('') }} className="text-xs text-red-400 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>

              {isCompleting && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <p className="mb-2 text-xs font-medium text-amber-800">When was this completed?</p>
                  <input
                    type="date"
                    className={inputCls}
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                  />
                  <textarea
                    className={`${inputCls} mt-1.5 resize-none`}
                    rows={2}
                    placeholder="Notes (optional)"
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button onClick={confirmDone} disabled={isPending} className={primaryBtn}>
                      {isPending ? '…' : 'Mark done'}
                    </button>
                    <button onClick={() => setCompletingIdx(null)} className={ghostBtn}>Cancel</button>
                  </div>
                </div>
              )}

              {openThreads.has(i) && (
                <CommentsThread
                  comments={item.comments ?? []}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  onAdd={(c) => addInterventionComment(cs!.id, i, c)}
                  onEdit={(cid, text) => editInterventionComment(cs!.id, i, cid, text)}
                  onDelete={(cid) => deleteInterventionComment(cs!.id, i, cid)}
                  onCommentsChange={(next) => {
                    setItems((prev) => prev.map((it, idx) =>
                      idx === i ? { ...it, comments: next } : it
                    ))
                  }}
                />
              )}
            </div>
          )
        })}

        {editingIdx === -1 && (
          <div className="space-y-1.5 rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
            <input
              className={inputCls}
              placeholder="Description *"
              value={editDraft.description}
              onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
            />
            <div className="relative">
              <select
                className="w-full appearance-none rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                value={editDraft.owner}
                onChange={(e) => setEditDraft((d) => ({ ...d, owner: e.target.value }))}
              >
                <option value="">Owner *</option>
                {staffUsers.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="date"
              className={inputCls}
              value={editDraft.due_date ?? ''}
              onChange={(e) => setEditDraft((d) => ({ ...d, due_date: e.target.value || null }))}
            />
            {editError && <p className="text-xs text-[#E24B4A]">{editError}</p>}
            <div className="flex gap-2">
              <button onClick={handleItemSave} disabled={isPending} className={primaryBtn}>
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingIdx(null); setEditError('') }} className={ghostBtn}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {editingIdx === null && (
        <button
          onClick={startAddItem}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
        >
          <span>+</span> Add another item
        </button>
      )}

      {deletingIdx !== null && items[deletingIdx] && (
        <ConfirmDialog
          title="Delete action item?"
          message={`"${items[deletingIdx].description}" will be removed. This cannot be undone.`}
          confirmLabel="Delete item"
          isPending={isPending}
          error={deleteError}
          onConfirm={() => {
            const idx = deletingIdx
            startTrans(async () => {
              try {
                const updated = items.filter((_, i) => i !== idx)
                await persistItems(updated)
                setItems(updated)
                setDeletingIdx(null)
                setDeleteError('')
                router.refresh()
              } catch (e) { setDeleteError(String(e)) }
            })
          }}
          onCancel={() => { setDeletingIdx(null); setDeleteError('') }}
        />
      )}
    </div>
  )
}

// ── Action item comments thread ───────────────────────────────────────────────

function fmtCommentTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function CommentToggleButton({ count, onClick }: { count: number; onClick: () => void }) {
  const title = count > 0 ? `${count} comment${count !== 1 ? 's' : ''}` : 'Add comment'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center gap-0.5 text-xs ${count > 0 ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-zinc-600'}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path fillRule="evenodd" d="M18 5.25a2.25 2.25 0 0 0-2.012-2.238 41.587 41.587 0 0 0-11.976 0A2.25 2.25 0 0 0 2 5.25v6.5A2.25 2.25 0 0 0 4.012 14a40.93 40.93 0 0 0 1.738.144V17a.75.75 0 0 0 1.218.586l3.323-2.654c.305-.244.682-.376 1.07-.382a41.27 41.27 0 0 0 4.627-.297A2.25 2.25 0 0 0 18 11.75v-6.5Z" clipRule="evenodd" />
      </svg>
      {count > 0
        ? <span className="font-medium tabular-nums">{count}</span>
        : <span className="font-semibold">+</span>}
    </button>
  )
}

function CommentsThread({
  comments,
  currentUserId,
  currentUserName,
  onAdd,
  onEdit,
  onDelete,
  onCommentsChange,
}: {
  comments:         InterventionComment[]
  currentUserId:    string
  currentUserName:  string | null
  onAdd:            (comment: InterventionComment) => Promise<void>
  onEdit:           (commentId: string, newText: string) => Promise<void>
  onDelete:         (commentId: string) => Promise<void>
  onCommentsChange: (next: InterventionComment[]) => void
}) {
  const router                  = useRouter()
  const [isPending, startTrans] = useTransition()
  const [draft, setDraft]               = useState('')
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editDraft, setEditDraft]       = useState('')

  function handleAdd() {
    const text = draft.trim()
    if (!text) return
    const newComment: InterventionComment = {
      id:        crypto.randomUUID(),
      by:        currentUserId,
      by_name:   currentUserName,
      at:        new Date().toISOString(),
      text,
      edited_at: null,
    }
    startTrans(async () => {
      try {
        await onAdd(newComment)
        onCommentsChange([...comments, newComment])
        setDraft('')
        router.refresh()
      } catch {}
    })
  }

  function startEditing(c: InterventionComment) {
    setEditingId(c.id)
    setEditDraft(c.text)
  }

  function handleEdit(commentId: string) {
    const text = editDraft.trim()
    if (!text) return
    startTrans(async () => {
      try {
        await onEdit(commentId, text)
        const now = new Date().toISOString()
        onCommentsChange(comments.map((c) =>
          c.id === commentId ? { ...c, text, edited_at: now } : c
        ))
        setEditingId(null)
        setEditDraft('')
        router.refresh()
      } catch {}
    })
  }

  function handleDelete(commentId: string) {
    if (!window.confirm('Delete this comment?')) return
    startTrans(async () => {
      try {
        await onDelete(commentId)
        onCommentsChange(comments.filter((c) => c.id !== commentId))
        router.refresh()
      } catch {}
    })
  }

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 bg-white p-2.5">
      {comments.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {comments.map((c) => {
            const isMine = c.by === currentUserId
            const isEditing = editingId === c.id
            return (
              <div key={c.id} className="rounded-md bg-zinc-50 px-3 py-2">
                {isEditing ? (
                  <>
                    <textarea
                      autoFocus
                      rows={2}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="w-full resize-y rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    />
                    <div className="mt-1.5 flex gap-2">
                      <button onClick={() => handleEdit(c.id)} disabled={isPending || !editDraft.trim()} className={primaryBtn}>
                        {isPending ? '…' : 'Save'}
                      </button>
                      <button onClick={() => { setEditingId(null); setEditDraft('') }} className={ghostBtn}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-xs">
                        <span className="font-medium text-zinc-800">{c.by_name ?? 'Unknown'}</span>
                        <span className="text-zinc-400">{' · '}{fmtCommentTime(c.at)}</span>
                        {c.edited_at && <span className="text-zinc-400">{' · edited'}</span>}
                      </div>
                      {isMine && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button onClick={() => startEditing(c)} className="text-xs text-zinc-400 hover:text-zinc-600">Edit</button>
                          <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
                        </div>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-zinc-700">{c.text}</p>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      <textarea
        autoFocus={comments.length === 0}
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={comments.length > 0 ? 'Reply…' : 'Add a comment…'}
        className="w-full resize-y rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900"
      />
      <div className="mt-1.5">
        <button onClick={handleAdd} disabled={isPending || !draft.trim()} className={primaryBtn}>
          {isPending ? '…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Follow-up ──────────────────────────────────────────────────────────

function Step4Card({
  cs,
  locked,
}: {
  cs: Case | null
  locked:       boolean
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()
  const [today, setToday] = useState('')
  useEffect(() => { setToday(new Date().toISOString().slice(0, 10)) }, [])

  const [editingDate,     setEditingDate]     = useState(false)
  const [editDate,        setEditDate]        = useState('')
  const [showAddUpdate,   setShowAddUpdate]   = useState(false)
  const [updateNote,      setUpdateNote]      = useState('')
  const [extendInUpdate,  setExtendInUpdate]  = useState(false)
  const [updateNewDate,   setUpdateNewDate]   = useState('')
  const [showClose,       setShowClose]       = useState(false)
  const [outcome,         setOutcome]         = useState<'resolved' | 'dropped' | 'other'>('resolved')
  const [outcomeNote,     setOutcomeNote]     = useState('')
  const [error,           setError]           = useState('')

  if (locked) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-3 flex items-center gap-2">
          <StepBadge n={4} done={false} active={false} />
          <span className="text-sm font-semibold text-zinc-400">Monitoring</span>
        </div>
        <p className="text-xs text-zinc-400">Complete step 3 first.</p>
      </div>
    )
  }

  const decisionDate = cs?.decision_date ?? null
  const daysUntil    = today && decisionDate
    ? Math.ceil((new Date(decisionDate).getTime() - new Date(today).getTime()) / 86_400_000)
    : null
  const isOverdue    = daysUntil !== null && daysUntil < 0
  const needsDecisionDate = decisionDate === null

  const daysChipCls = daysUntil === null        ? 'bg-zinc-100 text-zinc-500'
    : daysUntil < 0                             ? 'bg-red-100 text-red-700'
    : daysUntil <= 3                            ? 'bg-amber-100 text-amber-700'
    :                                             'bg-emerald-100 text-emerald-700'

  const daysText = daysUntil === null ? ''
    : daysUntil < 0  ? `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`
    : daysUntil === 0 ? 'Due today'
    :                   `${daysUntil} day${daysUntil !== 1 ? 's' : ''} remaining`

  const interventions   = cs?.interventions ?? []
  const totalItems    = interventions.length
  const doneItems     = interventions.filter((it) => !!it.completed_at).length
  const twoDaysLater  = today
    ? new Date(new Date(today).getTime() + 2 * 86_400_000).toISOString().slice(0, 10)
    : ''
  const nearDue = today
    ? interventions.filter((it) => !it.completed_at && it.due_date && it.due_date <= twoDaysLater)
    : []

  const updateLog = cs?.update_log ?? []

  function handleSaveDate() {
    if (!cs) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editDate)) { setError('Pick a valid date'); return }
    startTrans(async () => {
      try {
        await updateDecisionDate(cs.id, editDate)
        setEditingDate(false)
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  function handleAddUpdate() {
    if (!cs) return
    if (!updateNote.trim()) { setError('Note is required'); return }
    const dateToSend = extendInUpdate ? updateNewDate : null
    if (extendInUpdate && !/^\d{4}-\d{2}-\d{2}$/.test(updateNewDate)) {
      setError('Pick a valid date'); return
    }
    startTrans(async () => {
      try {
        await saveUpdate(cs.id, updateNote, dateToSend)
        setShowAddUpdate(false)
        setUpdateNote('')
        setExtendInUpdate(false)
        setUpdateNewDate('')
        setError('')
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  function handleClose() {
    if (!cs) return
    if (!outcomeNote.trim()) { setError('Note is required'); return }
    startTrans(async () => {
      try {
        await closeCase(cs.id, cs.learner_id, outcome, outcomeNote)
        router.refresh()
      } catch (e) { setError(String(e)) }
    })
  }

  return (
    <div className={`rounded-xl border bg-white p-4 ${isOverdue ? 'border-red-400' : needsDecisionDate ? 'border-amber-300' : 'border-zinc-200'}`}>
      <div className="mb-4 flex items-center gap-2">
        <StepBadge n={4} done={false} active />
        <span className="text-sm font-semibold text-zinc-900">Monitoring</span>
      </div>

      <div className="space-y-4">

        {/* ── Section 1: Decision date ── */}
        <div className={`rounded-lg px-3 py-2.5 ${needsDecisionDate ? 'border border-amber-300 bg-amber-50' : 'bg-zinc-50'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${needsDecisionDate ? 'text-amber-700' : 'text-zinc-500'}`}>
              {needsDecisionDate ? 'Decision date needed' : 'Decision date'}
            </span>
            {!editingDate && !showAddUpdate && !showClose && !needsDecisionDate && (
              <button
                onClick={() => { setEditingDate(true); setEditDate(decisionDate ?? ''); setError('') }}
                className="text-xs text-zinc-400 hover:text-zinc-600"
              >
                Edit
              </button>
            )}
          </div>
          {editingDate ? (
            <div className="mt-2 space-y-2">
              <input type="date" className={inputCls} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
              {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSaveDate} disabled={isPending} className={primaryBtn}>{isPending ? 'Saving…' : 'Save'}</button>
                <button onClick={() => { setEditingDate(false); setError('') }} className={ghostBtn}>Cancel</button>
              </div>
            </div>
          ) : needsDecisionDate ? (
            <div className="mt-1.5 space-y-2">
              <p className="text-xs text-amber-700">
                Set a date to review whether the case is working.
              </p>
              <button
                onClick={() => { setEditingDate(true); setEditDate(today); setError('') }}
                className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              >
                Set decision date
              </button>
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-800">
                {fmtDate(decisionDate!)}
              </span>
              {daysText && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${daysChipCls}`}>
                  {daysText}
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Section 2: Action items summary ── */}
        {totalItems > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-600">
              <span>{doneItems} of {totalItems} action item{totalItems !== 1 ? 's' : ''} completed</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-[#5BAE5B] transition-all"
                style={{ width: `${Math.round((doneItems / totalItems) * 100)}%` }}
              />
            </div>
            {nearDue.map((item, i) => (
              <p key={i} className="flex items-start gap-1 text-xs text-amber-700">
                <span className="shrink-0">⚠</span>
                <span>
                  Due in 2 days{item.owner ? `: ${item.owner} — ` : ': '}{item.description}
                </span>
              </p>
            ))}
          </div>
        )}

        {/* ── Section 3: Update log ── */}
        <div>
          {updateLog.length > 0 && (
            <ul className="mb-3 space-y-2.5 border-t border-zinc-100 pt-3">
              {updateLog.map((entry, i) => (
                <li key={i} className="text-xs">
                  <span className="text-zinc-400">
                    {fmtDate(entry.at)}{entry.by_name ? ` · ${entry.by_name}` : ''}
                  </span>
                  <p className="mt-0.5 text-zinc-700">{entry.note}</p>
                  {entry.decision_date_pushed_to && (
                    <p className="mt-0.5 text-zinc-400">
                      Decision date pushed to {fmtDate(entry.decision_date_pushed_to)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {!editingDate && !showClose && (
            showAddUpdate ? (
              <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <textarea
                  autoFocus
                  className={`${inputCls} min-h-[72px] resize-y`}
                  placeholder="What was discussed? What's the current status?"
                  value={updateNote}
                  onChange={(e) => setUpdateNote(e.target.value)}
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={extendInUpdate}
                    onChange={(e) => setExtendInUpdate(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                  />
                  Push decision date
                </label>
                {extendInUpdate && (
                  <input
                    type="date"
                    className={inputCls}
                    value={updateNewDate}
                    onChange={(e) => setUpdateNewDate(e.target.value)}
                  />
                )}
                {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
                <div className="flex gap-2">
                  <button onClick={handleAddUpdate} disabled={isPending} className={primaryBtn}>
                    {isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => { setShowAddUpdate(false); setError('') }} className={ghostBtn}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowAddUpdate(true); setUpdateNote(''); setExtendInUpdate(false); setUpdateNewDate(''); setError('') }}
                  className={ghostBtn}
                >
                  + Add update
                </button>
                <button
                  onClick={() => { setShowClose(true); setError('') }}
                  className={`${ghostBtn} border-red-200 text-red-600 hover:bg-red-50`}
                >
                  Close cs
                </button>
              </div>
            )
          )}
        </div>

        {/* ── Close cs form ── */}
        {!showAddUpdate && !editingDate && showClose && (
          <div>
            <div className="space-y-2 border-t border-zinc-100 pt-3">
              <label className={labelCls}>Outcome</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 pr-8 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value as typeof outcome)}
                >
                  <option value="resolved">Resolved</option>
                  <option value="dropped">Dropped out</option>
                  <option value="other">Other</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </div>
              <label className={labelCls}>Note *</label>
              <textarea
                className={`${inputCls} min-h-[72px] resize-y`}
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder="Describe the outcome…"
              />
              {error && <p className="text-xs text-[#E24B4A]">{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleClose} disabled={isPending} className={`${primaryBtn} bg-red-600 hover:bg-red-700`}>
                  {isPending ? 'Closing…' : 'Close cs'}
                </button>
                <button onClick={() => { setShowClose(false); setError('') }} className={ghostBtn}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
