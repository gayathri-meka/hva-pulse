'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/placements/Modal'
import EmailCampaignButton from '@/components/email/EmailCampaignButton'
import { sendEmailCampaign } from '@/app/(protected)/admissions/actions'
import ChallengeReviewDrawer from './ChallengeReviewDrawer'
import { paceMetrics } from '@/lib/challengePace'
import {
  REVIEW_DECISIONS_ENABLED,
  type CandidateSignals,
  type CriterionResult,
  type SystemDecision,
  type ReviewThresholds,
} from '@/lib/challengeReview'
import { configuredSesRubric, defaultOptionLabelsForSource, SES_SOURCE_CATALOG, sesMaxScore, effectiveWeight, PNS_SCORE, updateSesQuestionLabel, type SesAnswerSource } from '@/lib/ses'
import { GATING_RULES } from '@/lib/challengeReview'
import {
  bulkConfirmChallengeDecisions,
  releaseChallengeDecisions,
  clearChallengeDecisions,
  updateChallengeReviewConfig,
  updateChallengeReviewNote,
} from '@/app/(protected)/admissions/challenge/actions'

export type ChallengeReviewRow = {
  email: string
  name: string
  phone: string | null
  source: 'pulse' | 'sensai'
  signals: CandidateSignals
  criteria: CriterionResult[]
  systemDecision: SystemDecision
  failReasons: string[]
  finalDecision: 'selected' | 'rejected' | null
  reason: string | null
  rejectionReasonType: string | null
  rejectionMessage: string | null
  overrodeSystem: boolean
  decidedByName: string | null
  decidedAt: string | null
  systemChanged: boolean
  published: boolean // decision released to the candidate portal
  releasedAt: string | null
  comment: string
  // Activity + progress (folded in from the retired Pace tab).
  completedItems: number
  totalItems: number
  activityByDate: Record<string, number> // IST date → items done that day
  questionsByDate: Record<string, number> // IST date → attempted quiz questions that day
  readingByDate: Record<string, number> // IST date → reading materials active that day
}

// Which criteria get their own column, and the short header for each. Eligibility
// (straight-elimination) gates first, then engagement.
const CRITERIA_COLS: { key: string; label: string }[] = [
  // Need
  { key: 'ses', label: 'SES' },
  { key: 'college', label: 'College' },
  { key: 'per_capita_income', label: 'Per-capita' },
  // Work & Availability
  { key: 'graduation_timeline', label: 'Grad yr' },
  { key: 'work_commitment', label: 'Commit' },
  // Engagement
  { key: 'attempted_questions', label: 'Attempted' },
  { key: 'active_days', label: 'Active' },
  { key: 'span', label: 'Span' },
  { key: 'cramming', label: 'Cramming' },
  { key: 'consistency', label: 'Gap days' },
  { key: 'key_question_score', label: 'Challenge' },
]

const criterion = (row: ChallengeReviewRow, key: string) => row.criteria.find((c) => c.key === key)
const statusWord = (s: CriterionResult['status'] | undefined) =>
  s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'n/a'

function CriterionChip({ c }: { c: CriterionResult | undefined }) {
  if (!c || c.status === 'na')
    return <span className="text-zinc-300">—</span>
  // Disabled rule — show the value muted + struck so it's clear it isn't gating.
  if (c.disabled)
    return (
      <span title="Rule disabled — not gating the decision" className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-400 line-through">
        {c.value}
      </span>
    )
  if (c.informational)
    return (
      <span className="inline-flex items-center rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-600 ring-1 ring-sky-200">
        {c.value}
      </span>
    )
  const cls =
    c.status === 'pass'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
      : 'bg-red-50 text-red-700 ring-red-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${cls}`}>
      {c.status === 'pass' ? '✓' : '✗'} {c.value}
    </span>
  )
}

function DecisionBadge({ decision }: { decision: SystemDecision }) {
  if (decision === 'in_progress')
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">IN PROGRESS</span>
  if (decision === 'selected')
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">SELECT</span>
  if (decision === 'review')
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">REVIEW</span>
  return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">REJECT</span>
}

// Activity helpers (folded in from the retired Pace tab).
function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}
function heat(count: number): string {
  if (count <= 0) return 'text-zinc-300'
  if (count === 1) return 'bg-emerald-50 text-emerald-700'
  if (count <= 3) return 'bg-emerald-100 text-emerald-800'
  if (count <= 6) return 'bg-emerald-200 text-emerald-900'
  return 'bg-emerald-400 text-white'
}
// Mini bar chart of items done per day across the MEMBER's own first→last window
// (their day 1 →), exactly like the retired Pace sparkline.
function ActivitySparkline({ activityByDate }: { activityByDate: Record<string, number> }) {
  const { series } = paceMetrics(activityByDate)
  if (!series.length) return <span className="text-zinc-300">—</span>
  const max = Math.max(...series.map((s) => s.count), 1)
  return (
    <div className="flex h-6 items-end gap-px">
      {series.map((s) => (
        <div
          key={s.day}
          title={`Day ${s.day} · ${dateLabel(s.date)} — ${s.count} item${s.count === 1 ? '' : 's'}`}
          className={`min-w-[2px] flex-1 rounded-sm ${s.count ? 'bg-[#5BAE5B]' : 'bg-zinc-100'}`}
          style={{ height: s.count ? `${Math.max(12, (s.count / max) * 100)}%` : '2px' }}
        />
      ))}
    </div>
  )
}

const col = createColumnHelper<ChallengeReviewRow>()

function EditableComment({ row, cohortId, courseId, disabled }: { row: ChallengeReviewRow; cohortId: number; courseId: number; disabled: boolean }) {
  const [value, setValue] = useState(row.comment)
  const [saved, setSaved] = useState(row.comment)
  const [saving, startSaving] = useTransition()

  function save() {
    const next = value.trim()
    if (next === saved) return
    startSaving(async () => {
      const result = await updateChallengeReviewNote({ cohortId, courseId, email: row.email, note: next })
      if (result.ok) { setValue(next); setSaved(next) }
      else { setValue(saved); alert(result.error) }
    })
  }

  return <input value={value} disabled={disabled || saving} maxLength={2000} onChange={(e) => setValue(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setValue(saved); e.currentTarget.blur() } }} placeholder={disabled ? '—' : 'Add comment…'} className="w-full min-w-40 rounded border border-transparent bg-transparent px-2 py-1 text-xs text-zinc-700 outline-none hover:border-zinc-200 focus:border-[#5BAE5B] focus:bg-white disabled:text-zinc-400" />
}

export default function ChallengeReviewTable({
  rows,
  thresholds,
  cohortId,
  courseId,
  canReview,
  isAdmin,
  currentUserEmail,
  calendarDates,
}: {
  rows: ChallengeReviewRow[]
  thresholds: ReviewThresholds
  cohortId: number
  courseId: number
  canReview: boolean
  isAdmin: boolean
  currentUserEmail: string
  calendarDates: string[]
}) {
  const router = useRouter()
  const [openEmail, setOpenEmail] = useState<string | null>(null)
  const [bulkRows, setBulkRows] = useState<ChallengeReviewRow[] | null>(null)
  const [releaseRows, setReleaseRows] = useState<ChallengeReviewRow[] | null>(null)
  const [resetRows, setResetRows] = useState<ChallengeReviewRow[] | null>(null)
  const [editRules, setEditRules] = useState(false)
  const [pending, startTransition] = useTransition()

  const pendingCount = rows.filter((r) => r.finalDecision == null).length
  const selectedCount = rows.filter((r) => r.finalDecision === 'selected').length
  const rejectedCount = rows.filter((r) => r.finalDecision === 'rejected').length
  const publishedCount = rows.filter((r) => r.published).length
  const sysSelected = rows.filter((r) => r.systemDecision === 'selected').length
  const sysRejected = rows.filter((r) => r.systemDecision === 'rejected').length
  const sysReview = rows.filter((r) => r.systemDecision === 'review').length
  const sysInProgress = rows.filter((r) => r.systemDecision === 'in_progress').length

  const openRow = openEmail ? rows.find((r) => r.email === openEmail) ?? null : null

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Name',
        size: 190,
        enableColumnFilter: false,
        enableHiding: false,
        cell: (info) => (
          <button
            onClick={() => setOpenEmail(info.row.original.email)}
            className="text-left font-medium text-zinc-900 hover:text-[#5BAE5B] hover:underline"
          >
            {info.getValue() || info.row.original.email}
          </button>
        ),
      }),
      col.accessor('email', {
        header: 'Email',
        size: 220,
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
      }),
      col.accessor((r) => r.phone ?? '', {
        id: 'phone',
        header: 'Phone',
        size: 140,
        enableColumnFilter: false,
        cell: (info) => <span className="tabular-nums text-zinc-600">{info.getValue() || '—'}</span>,
      }),
      col.accessor((r) => statusWord(criterion(r, 'attempted_questions')?.status), {
        id: 'crit_attempted_questions', header: 'Attempted', size: 120,
        cell: (info) => <CriterionChip c={criterion(info.row.original, 'attempted_questions')} />,
      }),
      col.accessor((r) => (r.systemDecision === 'selected' ? 'Select' : r.systemDecision === 'review' ? 'Review' : r.systemDecision === 'in_progress' ? 'In progress' : 'Reject'), {
        id: 'system',
        header: 'System',
        size: 100,
        cell: (info) => <DecisionBadge decision={info.row.original.systemDecision} />,
      }),
      col.display({
        id: 'comment', header: 'Comment', size: 210,
        cell: (info) => <EditableComment row={info.row.original} cohortId={cohortId} courseId={courseId} disabled={!canReview} />,
      }),
      col.accessor(
        (r) => (r.finalDecision === 'selected' ? 'Selected' : r.finalDecision === 'rejected' ? 'Rejected' : 'Pending'),
        {
          id: 'status',
          header: 'Status',
          size: 130,
          cell: (info) => {
            const r = info.row.original
            const base =
              r.finalDecision === 'selected'
                ? 'bg-emerald-50 text-emerald-700'
                : r.finalDecision === 'rejected'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-amber-50 text-amber-700'
            return (
              <span className="inline-flex items-center gap-1">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${base}`}>{info.getValue()}</span>
                {r.systemChanged && <span title="System changed its mind since this was verified">⚠</span>}
              </span>
            )
          },
        },
      ),
      // Portal release state — its own column so it can be filtered independently
      // of the Selected/Rejected verdict. Pending (no decision) rows can't be released.
      col.accessor((r) => (r.published ? 'Released' : r.finalDecision ? 'Not released' : '—'), {
        id: 'released',
        header: 'Released',
        size: 120,
        cell: (info) => {
          const v = info.getValue()
          if (v === 'Released')
            return (
              <span
                title="Decision is visible on the candidate portal"
                className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-700"
              >
                Released
              </span>
            )
          if (v === 'Not released')
            return <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Not released</span>
          return <span className="text-zinc-300">—</span>
        },
      }),
      col.display({
        id: 'review',
        header: '',
        size: 110,
        enableHiding: false,
        cell: (info) => (
          <div className="flex pl-1">
            <button
              onClick={() => setOpenEmail(info.row.original.email)}
              className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Review
            </button>
          </div>
        ),
      }),
      col.accessor((r) => r.decidedByName ?? '', {
        id: 'decided_by',
        header: 'Decided by',
        size: 130,
        enableColumnFilter: false,
        cell: (info) => <span className="text-xs text-zinc-500">{info.getValue() || '—'}</span>,
      }),
      col.accessor((r) => r.releasedAt ?? '', {
        id: 'released_date', header: 'Released Date', size: 120, enableColumnFilter: false,
        cell: (info) => <span className="text-xs tabular-nums text-zinc-500">{info.getValue() ? new Date(info.getValue()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>,
      }),
      ...CRITERIA_COLS.filter((cc) => cc.key !== 'attempted_questions').map((cc) =>
        col.accessor((r) => statusWord(criterion(r, cc.key)?.status), {
          id: `crit_${cc.key}`,
          header: cc.label,
          size: 120,
          cell: (info) => <CriterionChip c={criterion(info.row.original, cc.key)} />,
          // Numeric criteria (income, SES, % attempted, active days, span, cramming,
          // challenge score) sort by their actual value — least → highest — with
          // no-data rows last. Non-numeric gates fall back to pass/fail/na order.
          sortingFn: (a, b) => {
            const ca = criterion(a.original, cc.key)
            const cb = criterion(b.original, cc.key)
            const va = ca?.sortValue
            const vb = cb?.sortValue
            if (va != null && vb != null) return va === vb ? 0 : va < vb ? -1 : 1
            if (va != null) return -1 // rows with a value sort before no-data rows
            if (vb != null) return 1
            return statusWord(ca?.status).localeCompare(statusWord(cb?.status))
          },
        }),
      ),
      // ── Progress + activity (folded in from the retired Pace tab) ──────────
      col.accessor((r) => (r.totalItems ? Math.round((r.completedItems / r.totalItems) * 100) : 0), {
        id: 'completed',
        header: 'Completed',
        size: 110,
        enableColumnFilter: false,
        cell: (info) => {
          const r = info.row.original
          return <span className="text-xs text-zinc-600">{r.totalItems ? `${r.completedItems}/${r.totalItems}` : '—'}</span>
        },
      }),
      col.display({
        id: 'activity',
        header: 'Activity',
        size: 150,
        cell: (info) => <ActivitySparkline activityByDate={info.row.original.activityByDate} />,
      }),
      // Per-date heat columns — quiz questions plus reading-material activity.
      // `compact` gives them tight padding + a readable "16 Jun" header.
      ...calendarDates.map((date) =>
        col.accessor((r) => (r.questionsByDate[date] ?? 0) + (r.readingByDate[date] ?? 0), {
          id: `d_${date}`,
          header: dateLabel(date),
          size: 56,
          enableSorting: false,
          enableColumnFilter: false,
          meta: { compact: true },
          cell: (info) => {
            const v = info.getValue() as number
            return <div className={`mx-auto h-6 w-7 rounded text-center text-[11px] leading-6 ${heat(v)}`}>{v || ''}</div>
          },
        }),
      ),
    ],
    [calendarDates, canReview, cohortId, courseId],
  )

  function runBulk() {
    if (!bulkRows || !REVIEW_DECISIONS_ENABLED) return
    startTransition(async () => {
      const res = await bulkConfirmChallengeDecisions({
        cohortId,
        courseId,
        items: bulkRows.map((r) => ({
          email: r.email,
          name: r.name,
          signals: r.signals,
          systemDecision: r.systemDecision,
          criteriaSnapshot: r.criteria,
        })),
      })
      setBulkRows(null)
      if (res.ok) router.refresh()
      else alert(res.error)
    })
  }

  function runRelease() {
    if (!releaseRows) return
    startTransition(async () => {
      const res = await releaseChallengeDecisions({
        cohortId,
        courseId,
        emails: releaseRows.map((r) => r.email),
        publish: true,
      })
      setReleaseRows(null)
      if (res.ok) router.refresh()
      else alert(res.error)
    })
  }

  function runReset() {
    if (!resetRows) return
    startTransition(async () => {
      const res = await clearChallengeDecisions({ cohortId, courseId, emails: resetRows.map((r) => r.email) })
      setResetRows(null)
      if (res.ok) router.refresh()
      else alert(res.error)
    })
  }

  return (
    <div>
      {/* Summary strip — team verdicts, then what the system suggests. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-zinc-500">
          <strong className="text-amber-600">{pendingCount}</strong> pending
        </span>
        <span className="text-zinc-500">
          <strong className="text-emerald-600">{selectedCount}</strong> selected
        </span>
        <span className="text-zinc-500">
          <strong className="text-red-600">{rejectedCount}</strong> rejected
        </span>
        <span className="text-zinc-500">
          <strong className="text-sky-600">{publishedCount}</strong> released
        </span>
        <span className="h-4 w-px bg-zinc-200" aria-hidden />
        <span className="text-zinc-400">
          System suggests <strong className="text-emerald-600">{sysSelected}</strong> select
          {' '}· <strong className="text-red-600">{sysRejected}</strong> reject
          {sysReview > 0 && <> · <strong className="text-amber-600">{sysReview}</strong> need review</>}
          {sysInProgress > 0 && <> · <strong className="text-slate-500">{sysInProgress}</strong> in progress</>}
        </span>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        storageKey="challenge-review"
        initialSorting={[{ id: 'system', desc: true }]}
        getRowId={(r) => r.email}
        enableRowSelection={canReview}
        pinnedLeft={['name']}
        searchKeys={['name', 'email', 'phone']}
        searchPlaceholder="Search name, email or phone…"
        csvFilename="challenge_review"
        emptyMessage="No candidates to review yet."
        toolbarRight={({ selectedRows, filteredRows }) => (
          <div className="flex items-center gap-2">
            {isAdmin && (
              <EmailCampaignButton
                rows={((selectedRows.length ? selectedRows : filteredRows) as ChallengeReviewRow[]).map((r) => ({
                  name: r.name,
                  email: r.email,
                }))}
                fields={['name', 'email']}
                defaultRecipientField="email"
                currentUserEmail={currentUserEmail}
                action={sendEmailCampaign}
                campaign="challenge"
                label="Email"
                title="Email challenge members (mail-merge)"
              />
            )}
            {canReview && selectedRows.length > 0 && (
              <button
                onClick={() => setBulkRows(selectedRows)}
                disabled={!REVIEW_DECISIONS_ENABLED}
                title={REVIEW_DECISIONS_ENABLED ? undefined : 'Decisions are locked until the team is ready'}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:hover:bg-zinc-300"
              >
                Confirm system verdict ({selectedRows.length})
              </button>
            )}
            {canReview && selectedRows.filter((r) => r.finalDecision && !r.published).length > 0 && (
              <button
                onClick={() => setReleaseRows(selectedRows.filter((r) => r.finalDecision && !r.published))}
                title="Make the decision visible on the candidate's portal"
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700"
              >
                Release to candidates ({selectedRows.filter((r) => r.finalDecision && !r.published).length})
              </button>
            )}
            {canReview && selectedRows.filter((r) => r.finalDecision).length > 0 && (
              <button
                onClick={() => setResetRows(selectedRows.filter((r) => r.finalDecision))}
                title="Undo — send back to Pending (also un-releases)"
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Reset to pending ({selectedRows.filter((r) => r.finalDecision).length})
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => setEditRules(true)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Edit rules
              </button>
            )}
          </div>
        )}
      />

      {openRow && (
        <ChallengeReviewDrawer
          row={openRow}
          cohortId={cohortId}
          courseId={courseId}
          canReview={canReview}
          onClose={() => setOpenEmail(null)}
        />
      )}

      {bulkRows && (
        <Modal title="Confirm system verdict" onClose={() => setBulkRows(null)}>
          <p className="text-sm text-zinc-600">
            Record the system&apos;s verdict?{' '}
            {bulkRows.filter((r) => r.systemDecision === 'selected').length} will be marked{' '}
            <strong className="text-emerald-700">selected</strong> and{' '}
            {bulkRows.filter((r) => r.systemDecision === 'rejected').length}{' '}
            <strong className="text-red-700">rejected</strong>.
            {bulkRows.filter((r) => r.systemDecision === 'review' || r.systemDecision === 'in_progress').length > 0 && (
              <>
                {' '}
                <strong className="text-amber-700">{bulkRows.filter((r) => r.systemDecision === 'review' || r.systemDecision === 'in_progress').length}</strong>{' '}
                still <strong className="text-amber-700">in progress or needing review</strong> will be skipped — handle those in the drawer.
              </>
            )}{' '}
            Overrides must be done one at a time in the drawer.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setBulkRows(null)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={runBulk}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending ? 'Confirming…' : 'Confirm'}
            </button>
          </div>
        </Modal>
      )}

      {releaseRows && (
        <Modal title="Release to candidates" onClose={() => setReleaseRows(null)}>
          <p className="text-sm text-zinc-600">
            Make the decision visible on the candidate portal for <strong>{releaseRows.length}</strong> candidate
            {releaseRows.length === 1 ? '' : 's'}?{' '}
            {releaseRows.filter((r) => r.finalDecision === 'selected').length} will see{' '}
            <strong className="text-emerald-700">selected</strong> and{' '}
            {releaseRows.filter((r) => r.finalDecision === 'rejected').length} will see a{' '}
            <strong className="text-red-700">rejection</strong>. This is what candidates see on their portal.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setReleaseRows(null)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={runRelease}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {pending ? 'Releasing…' : 'Release'}
            </button>
          </div>
        </Modal>
      )}

      {resetRows && (
        <Modal title="Reset to pending" onClose={() => setResetRows(null)}>
          <p className="text-sm text-zinc-600">
            Undo the decision for <strong>{resetRows.length}</strong> candidate{resetRows.length === 1 ? '' : 's'} and send
            them back to <strong>Pending</strong>? Any that were released to the portal will also be un-released.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={() => setResetRows(null)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              disabled={pending}
              onClick={runReset}
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending ? 'Resetting…' : 'Reset to pending'}
            </button>
          </div>
        </Modal>
      )}

      {editRules && (
        <EditRulesModal
          thresholds={thresholds}
          cohortId={cohortId}
          courseId={courseId}
          onClose={() => setEditRules(false)}
        />
      )}
    </div>
  )
}

function EditRulesModal({
  thresholds,
  cohortId,
  courseId,
  onClose,
}: {
  thresholds: ReviewThresholds
  cohortId: number
  courseId: number
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [t, setT] = useState<ReviewThresholds>(thresholds)
  const [tab, setTab] = useState<'thresholds' | 'ses'>('thresholds')

  const field = (key: keyof ReviewThresholds, label: string, suffix: string) => (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-zinc-700">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          value={t[key] as number}
          onChange={(e) => setT({ ...t, [key]: Number(e.target.value) })}
          className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
        />
        <span className="text-xs text-zinc-400">{suffix}</span>
      </span>
    </label>
  )

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updateChallengeReviewConfig({ cohortId, courseId, thresholds: t })
      if (!res.ok) { setError(res.error); return }
      router.refresh()
      onClose()
    })
  }

  const sesQuestions = configuredSesRubric(t.sesQuestions)
  const sesMax = sesMaxScore(t.sesWeights, t.sesQuestions)

  function addSesQuestion() {
    const key = `ses_custom_${crypto.randomUUID().replaceAll('-', '')}`
    setT({
      ...t,
      sesQuestions: [...(t.sesQuestions ?? sesQuestions.map(({ key, label }) => ({ key, label }))), {
        key,
        label: 'New SES question',
        optionLabels: { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4' },
      }],
      sesWeights: { ...(t.sesWeights ?? {}), [key]: 1 },
    })
  }

  return (
    <Modal title="Edit review rules" onClose={onClose} wide>
      <div className="mb-4 flex gap-1 border-b border-zinc-200">
        {(['thresholds', 'ses'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
              tab === k ? 'border-[#5BAE5B] text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {k === 'thresholds' ? 'Thresholds' : 'SES'}
          </button>
        ))}
      </div>

      {tab === 'thresholds' && (
      <>
      <p className="mb-3 text-xs text-zinc-500">
        Thresholds the system uses to recommend select vs reject. Operators are fixed; only the numbers are editable.
        Changing these re-evaluates every candidate.
      </p>

      {/* Enable / disable rules */}
      <div className="mb-4 rounded-lg border border-zinc-200 p-3">
        <div className="text-sm font-medium text-zinc-700">Active rules</div>
        <p className="mb-2 mt-0.5 text-[11px] text-zinc-400">Turn a rule off to stop it gating the decision (it still shows in the table, greyed out).</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {GATING_RULES.map((r) => {
            const disabled = (t.disabledRules ?? []).includes(r.key)
            return (
              <label key={r.key} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={!disabled}
                  onChange={() => {
                    const cur = t.disabledRules ?? []
                    setT({ ...t, disabledRules: disabled ? cur.filter((k) => k !== r.key) : [...cur, r.key] })
                  }}
                  className="h-3.5 w-3.5 rounded border-zinc-300 accent-[#5BAE5B]"
                />
                <span className={disabled ? 'text-zinc-400 line-through' : ''}>{r.label}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div className="divide-y divide-zinc-100">
        {field('minQuestionsAttemptedPct', 'Questions attempted must be at least', '%')}
        {field('minActiveDays', 'Active days must be greater than', 'days')}
        {field('minSpanDays', 'Span must be at least', 'days')}
        {field('maxCrammingPct', 'Cramming must be under', '%')}
        <label className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-zinc-700">
            Gap days (span − active) must be under
            <span className="mt-0.5 block text-[11px] text-zinc-400">idle days between first and last activity · under 4 = at most 3 gaps</span>
          </span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              value={t.maxGapDays}
              onChange={(e) => setT({ ...t, maxGapDays: Number(e.target.value) })}
              className="w-24 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
            />
            <span className="text-xs text-zinc-400">days</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-zinc-700">
            Reject a working candidate earning over
            <span className="mt-0.5 block text-[11px] text-zinc-400">their own salary, per year · rejected even if willing to quit</span>
          </span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              value={t.maxWorkIncomeAnnual}
              onChange={(e) => setT({ ...t, maxWorkIncomeAnnual: Number(e.target.value) })}
              className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
            />
            <span className="text-xs text-zinc-400">₹/yr</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-zinc-700">
            Per-capita income must be under
            <span className="mt-0.5 block text-[11px] text-zinc-400">annual family income ÷ family size · blank = not set</span>
          </span>
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              value={t.maxPerCapitaIncomeAnnual ?? ''}
              placeholder="—"
              onChange={(e) =>
                setT({ ...t, maxPerCapitaIncomeAnnual: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className="w-28 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
            />
            <span className="text-xs text-zinc-400">₹/yr</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-3 py-2">
          <span className="text-sm text-zinc-700">
            Challenge end date
            <span className="mt-0.5 block text-[11px] text-zinc-400">after this, everyone is evaluated · before it, mid-challenge learners stay &ldquo;In progress&rdquo; (a learner is also finished 14 days after their first activity) · blank = not set</span>
          </span>
          <input
            type="date"
            value={t.challengeEndDate ?? ''}
            onChange={(e) => setT({ ...t, challengeEndDate: e.target.value || undefined })}
            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-sm text-zinc-700">Excluded colleges</div>
        <p className="mb-2 text-[11px] text-zinc-400">
          Colleges we won&apos;t take learners from (one per line). A candidate whose college matches one is eliminated.
          Leave empty to disable this gate.
        </p>
        <textarea
          rows={5}
          value={(t.excludedColleges ?? []).join('\n')}
          onChange={(e) => setT({ ...t, excludedColleges: e.target.value.split('\n') })}
          placeholder={'e.g.\nNitte Meenakshi Institute of Technology\nBMS College of Engineering'}
          className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
        />
      </div>
      </>
      )}

      {tab === 'ses' && (
      <>
      <p className="mb-3 text-xs text-zinc-500">
        Socio-economic need score = each answer&apos;s option score (fixed, shown below) × the question&apos;s weight,
        summed. Higher = more need. A candidate passes when their score reaches the cutoff. Edit weights + cutoff here;
        the option scores are fixed.
      </p>
      <label className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-zinc-50 px-3 py-2">
        <span className="text-sm font-medium text-zinc-800">
          Need established when SES score ≥
          <span className="mt-0.5 block text-[11px] font-normal text-zinc-400">blank = SES gate off · score is out of a max of {sesMax}</span>
        </span>
        <input
          type="number"
          value={t.sesCutoff ?? ''}
          placeholder="—"
          onChange={(e) => setT({ ...t, sesCutoff: e.target.value === '' ? undefined : Number(e.target.value) })}
          className="w-20 rounded-lg border border-zinc-300 px-2 py-1 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
        />
      </label>
      <p className="mb-1.5 text-[11px] text-zinc-400">
        Columns 0–4 are the fixed score each option earns. &ldquo;PNS&rdquo; = prefer not to say (scored as {PNS_SCORE}).
        Question text, option text under scores 0–4, and weight are editable. The numeric scores remain fixed.
      </p>
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
              <th className="px-2 py-1.5 text-left font-semibold">Question</th>
              {[0, 1, 2, 3, 4].map((s) => (
                <th key={s} className="px-2 py-1.5 text-center font-semibold">{s}</th>
              ))}
              <th className="px-2 py-1.5 text-center font-semibold">PNS</th>
              <th className="px-2 py-1.5 text-center font-semibold">Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sesQuestions.map((q) => {
              const pnsAvg = q.pnsLetter ? PNS_SCORE : null
              return (
                <tr key={q.key} className="align-middle">
                  <td className="px-2 py-1.5 text-zinc-700">
                    <input
                      type="text"
                      aria-label={`Question text for ${q.label}`}
                      value={q.label}
                      onChange={(e) => {
                        const label = e.target.value
                        setT({
                          ...t,
                          sesQuestions: (t.sesQuestions ?? sesQuestions.map(({ key, label }) => ({ key, label }))).map((item) => {
                            if (item.key !== q.key) return item
                            // Clearing a custom rule disconnects its source so a
                            // mistaken selection can be made again.
                            return updateSesQuestionLabel(item, label)
                          }),
                        })
                      }}
                      className="min-w-48 w-full rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
                    />
                    {q.key.startsWith('ses_custom_') && q.activeForScoring === false && (
                      <select
                        aria-label={`Answer source for ${q.label}`}
                        defaultValue=""
                        onChange={(e) => {
                          const source = e.target.value as SesAnswerSource
                          if (!source) return
                          const current: NonNullable<ReviewThresholds['sesQuestions']> =
                            t.sesQuestions ?? sesQuestions.map(({ key, label }) => ({ key, label }))
                          const sourceLabel = SES_SOURCE_CATALOG.find((item) => item.key === source)?.label ?? 'New SES question'
                          setT({
                            ...t,
                            sesQuestions: current.map((item) => item.key === q.key ? {
                              ...item,
                              label: item.label.trim() ? item.label : sourceLabel.replace(/ \(.+\)$/, ''),
                              answerSource: source,
                              optionLabels: defaultOptionLabelsForSource(source),
                            } : item),
                          })
                        }}
                        className="mt-1 w-full rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 focus:border-[#5BAE5B] focus:outline-none"
                      >
                        <option value="">Choose candidate data source…</option>
                        {SES_SOURCE_CATALOG.map((source) => (
                          <option key={source.key} value={source.key}>{source.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  {[0, 1, 2, 3, 4].map((s) => {
                    const opt = q.options.find((o) => o.score === s)
                    return (
                      <td key={s} className="px-2 py-1.5 text-center text-[11px] leading-tight text-zinc-500">
                        {opt ? (
                          <input
                            type="text"
                            aria-label={`${q.label}, score ${s} option text`}
                            value={opt.label}
                            onChange={(e) => {
                              const current: NonNullable<ReviewThresholds['sesQuestions']> =
                                t.sesQuestions ?? sesQuestions.map(({ key, label }) => ({ key, label }))
                              setT({
                                ...t,
                                sesQuestions: current.map((item) => item.key === q.key ? {
                                  ...item,
                                  optionLabels: { ...(item.optionLabels ?? {}), [String(s)]: e.target.value },
                                } : item),
                              })
                            }}
                            className="w-24 rounded-lg border border-zinc-300 px-1.5 py-1 text-center text-[11px] text-zinc-700 focus:border-[#5BAE5B] focus:outline-none"
                          />
                        ) : <span className="text-zinc-300">—</span>}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1.5 text-center text-[11px] text-zinc-500">
                    {pnsAvg != null ? pnsAvg : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="number"
                      value={effectiveWeight(q, t.sesWeights)}
                      onChange={(e) =>
                        setT({ ...t, sesWeights: { ...(t.sesWeights ?? {}), [q.key]: Number(e.target.value) } })
                      }
                      className="w-14 rounded-lg border border-zinc-300 px-1.5 py-1 text-center text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={addSesQuestion}
        className="mt-2 inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        aria-label="Add SES question"
      >
        <span aria-hidden="true" className="text-base leading-none">＋</span> Add question
      </button>
      </>
      )}

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
          Cancel
        </button>
        <button
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e9c4e] disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save rules'}
        </button>
      </div>
    </Modal>
  )
}
