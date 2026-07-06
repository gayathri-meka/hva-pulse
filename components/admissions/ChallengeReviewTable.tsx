'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/placements/Modal'
import ChallengeReviewDrawer from './ChallengeReviewDrawer'
import {
  REVIEW_DECISIONS_ENABLED,
  type CandidateSignals,
  type CriterionResult,
  type SystemDecision,
  type ReviewThresholds,
} from '@/lib/challengeReview'
import type { IntakeRaw } from '@/lib/challengeIntake'
import {
  bulkConfirmChallengeDecisions,
  updateChallengeReviewConfig,
} from '@/app/(protected)/admissions/challenge/actions'

export type ChallengeReviewRow = {
  email: string
  name: string
  source: 'pulse' | 'sensai'
  signals: CandidateSignals
  criteria: CriterionResult[]
  systemDecision: SystemDecision
  failReasons: string[]
  finalDecision: 'selected' | 'rejected' | null
  reason: string | null
  overrodeSystem: boolean
  decidedByName: string | null
  decidedAt: string | null
  systemChanged: boolean
  intake: IntakeRaw | null // raw synced intake answers (null if not synced)
}

// Which criteria get their own column, and the short header for each. Eligibility
// (straight-elimination) gates first, then engagement.
const CRITERIA_COLS: { key: string; label: string }[] = [
  // Need
  { key: 'ses', label: 'SES' },
  { key: 'college_tier', label: 'College' },
  { key: 'income_ceiling', label: 'Income' },
  // Work & Availability
  { key: 'graduation_timeline', label: 'Grad yr' },
  { key: 'work_commitment', label: 'Commit' },
  // Engagement
  { key: 'attempted_questions', label: 'Attempted' },
  { key: 'active_days', label: 'Active' },
  { key: 'span', label: 'Span' },
  { key: 'cramming', label: 'Cramming' },
  { key: 'key_question_score', label: 'Key-Q' },
]

const criterion = (row: ChallengeReviewRow, key: string) => row.criteria.find((c) => c.key === key)
const statusWord = (s: CriterionResult['status'] | undefined) =>
  s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'n/a'

function CriterionChip({ c }: { c: CriterionResult | undefined }) {
  if (!c || c.status === 'na')
    return <span className="text-zinc-300">—</span>
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
  return decision === 'selected' ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">SELECT</span>
  ) : (
    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">REJECT</span>
  )
}

const col = createColumnHelper<ChallengeReviewRow>()

export default function ChallengeReviewTable({
  rows,
  thresholds,
  cohortId,
  courseId,
  canReview,
}: {
  rows: ChallengeReviewRow[]
  thresholds: ReviewThresholds
  cohortId: number
  courseId: number
  canReview: boolean
}) {
  const router = useRouter()
  const [openEmail, setOpenEmail] = useState<string | null>(null)
  const [bulkRows, setBulkRows] = useState<ChallengeReviewRow[] | null>(null)
  const [editRules, setEditRules] = useState(false)
  const [pending, startTransition] = useTransition()

  const pendingCount = rows.filter((r) => r.finalDecision == null).length
  const selectedCount = rows.filter((r) => r.finalDecision === 'selected').length
  const rejectedCount = rows.filter((r) => r.finalDecision === 'rejected').length
  const sysSelected = rows.filter((r) => r.systemDecision === 'selected').length

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
      col.accessor((r) => (r.systemDecision === 'selected' ? 'Select' : 'Reject'), {
        id: 'system',
        header: 'System',
        size: 100,
        cell: (info) => <DecisionBadge decision={info.row.original.systemDecision} />,
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
      col.accessor((r) => r.decidedByName ?? '', {
        id: 'decided_by',
        header: 'Decided by',
        size: 130,
        enableColumnFilter: false,
        cell: (info) => <span className="text-xs text-zinc-500">{info.getValue() || '—'}</span>,
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
      ...CRITERIA_COLS.map((cc) =>
        col.accessor((r) => statusWord(criterion(r, cc.key)?.status), {
          id: `crit_${cc.key}`,
          header: cc.label,
          size: 120,
          cell: (info) => <CriterionChip c={criterion(info.row.original, cc.key)} />,
        }),
      ),
    ],
    [],
  )

  function runBulk() {
    if (!bulkRows || !REVIEW_DECISIONS_ENABLED) return
    startTransition(async () => {
      const res = await bulkConfirmChallengeDecisions({
        cohortId,
        courseId,
        items: bulkRows.map((r) => ({
          email: r.email,
          systemDecision: r.systemDecision,
          criteriaSnapshot: r.criteria,
        })),
      })
      setBulkRows(null)
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
        <span className="h-4 w-px bg-zinc-200" aria-hidden />
        <span className="text-zinc-400">
          System suggests <strong className="text-emerald-600">{sysSelected}</strong> select
        </span>
      </div>

      <DataTable
        data={rows}
        columns={columns}
        storageKey="challenge-review"
        getRowId={(r) => r.email}
        enableRowSelection={canReview}
        pinnedLeft={['name']}
        searchKeys={['name', 'email']}
        searchPlaceholder="Search name or email…"
        csvFilename="challenge_review"
        emptyMessage="No candidates to review yet."
        toolbarRight={({ selectedRows }) => (
          <div className="flex items-center gap-2">
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
            {canReview && (
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
            Record the system&apos;s verdict for <strong>{bulkRows.length}</strong> candidate
            {bulkRows.length === 1 ? '' : 's'}?{' '}
            {bulkRows.filter((r) => r.systemDecision === 'selected').length} will be marked{' '}
            <strong className="text-emerald-700">selected</strong> and{' '}
            {bulkRows.filter((r) => r.systemDecision === 'rejected').length}{' '}
            <strong className="text-red-700">rejected</strong>. Overrides must be done one at a time in the drawer.
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

  const field = (key: keyof ReviewThresholds, label: string, suffix: string) => (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-zinc-700">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          value={t[key]}
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

  return (
    <Modal title="Edit review rules" onClose={onClose}>
      <p className="mb-3 text-xs text-zinc-500">
        Thresholds the system uses to recommend select vs reject. Operators are fixed; only the numbers are editable.
        Changing these re-evaluates every candidate.
      </p>
      <div className="divide-y divide-zinc-100">
        {field('minAttemptedQuestions', 'Attempted questions must be greater than', 'questions')}
        {field('minActiveDays', 'Active days must be greater than', 'days')}
        {field('minSpanDays', 'Span must be at least', 'days')}
        {field('maxCrammingPct', 'Cramming must be under', '%')}
      </div>
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
