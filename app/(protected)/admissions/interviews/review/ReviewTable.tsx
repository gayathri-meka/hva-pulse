'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import Modal from '@/components/placements/Modal'
import { stageLabel, type ReviewStage } from '@/lib/interviewReview'
import { setInterviewDecision, undoInterviewDecision, type InterviewReviewTableRow, type ReviewRoundCell } from '../review-actions'

const STAGE_STYLE: Record<ReviewStage, string> = {
  round1: 'bg-zinc-100 text-zinc-600',
  awaiting_r1_review: 'bg-amber-50 text-amber-700',
  round2_open: 'bg-sky-50 text-sky-700',
  round2: 'bg-zinc-100 text-zinc-600',
  awaiting_final: 'bg-amber-50 text-amber-700',
  selected: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

const STATUS_LABEL: Record<ReviewRoundCell['status'], string> = {
  not_booked: 'Not booked',
  scheduled: 'Scheduled',
  completed: 'Completed',
  no_show: 'No-show',
}
const STATUS_STYLE: Record<ReviewRoundCell['status'], string> = {
  not_booked: 'text-zinc-400',
  scheduled: 'bg-sky-50 text-sky-700',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-red-50 text-red-700',
}
const REC_LABEL: Record<string, string> = { advance: 'Advance', borderline: 'Borderline', no: 'Do not advance' }
const REC_STYLE: Record<string, string> = { advance: 'bg-emerald-50 text-emerald-700', borderline: 'bg-amber-50 text-amber-700', no: 'bg-red-50 text-red-700' }

function RoundCell({ cell }: { cell: ReviewRoundCell }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[cell.status]}`}>
        {STATUS_LABEL[cell.status]}
      </span>
      {cell.recommendation && (
        <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${REC_STYLE[cell.recommendation]}`}>
          {REC_LABEL[cell.recommendation]}
        </span>
      )}
      {cell.interviewId && (
        <Link href={`/admissions/interviews/notes/${cell.interviewId}`} className="text-[11px] font-medium text-[#5BAE5B] hover:underline">
          notes →
        </Link>
      )}
    </div>
  )
}

const col = createColumnHelper<InterviewReviewTableRow>()

type Pending = { title: string; body: string; confirmLabel: string; tone: 'green' | 'red' | 'zinc'; run: () => Promise<{ ok: boolean; error?: string }> }

export default function ReviewTable({ rows }: { rows: InterviewReviewTableRow[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [action, setAction] = useState<Pending | null>(null)
  const [error, setError] = useState<string | null>(null)

  function run() {
    if (!action) return
    setError(null)
    startTransition(async () => {
      const res = await action.run()
      if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
      setAction(null)
      router.refresh()
    })
  }

  const columns = useMemo(
    () => [
      col.accessor((r) => r.name ?? r.email, {
        id: 'name',
        header: 'Candidate',
        size: 190,
        enableColumnFilter: false,
        cell: (info) => (
          <div>
            <div className="font-medium text-zinc-900">{info.getValue()}</div>
            <div className="text-[11px] text-zinc-400">{info.row.original.email}</div>
          </div>
        ),
      }),
      col.accessor((r) => stageLabel(r.stage), {
        id: 'stage',
        header: 'Stage',
        size: 150,
        cell: (info) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STAGE_STYLE[info.row.original.stage]}`}>{info.getValue()}</span>,
      }),
      col.display({
        id: 'round1',
        header: 'Round 1 · Motivation',
        size: 150,
        cell: (info) => <RoundCell cell={info.row.original.round1} />,
      }),
      col.display({
        id: 'r1_decision',
        header: 'R1 decision',
        size: 170,
        enableHiding: false,
        cell: (info) => {
          const r = info.row.original
          if (r.canReleaseStage1)
            return (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setAction({ title: 'Release advance', body: `Advance ${r.name ?? r.email} to the Coding round? They'll be able to book a Round 2 slot.`, confirmLabel: 'Release advance', tone: 'green', run: () => setInterviewDecision({ email: r.email, gate: 'stage1', decision: 'advance' }) })}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                >
                  Advance
                </button>
                <button
                  onClick={() => setAction({ title: 'Reject after Round 1', body: `Reject ${r.name ?? r.email}? They'll see a rejection on their portal.`, confirmLabel: 'Reject', tone: 'red', run: () => setInterviewDecision({ email: r.email, gate: 'stage1', decision: 'rejected' }) })}
                  className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                >
                  Reject
                </button>
              </div>
            )
          if (r.stage1 === 'advance') return <DecisionBadge label="Advanced" tone="green" onUndo={() => setAction(undoAction(r.email, 'stage1', r.name ?? r.email))} />
          if (r.stage1 === 'rejected') return <DecisionBadge label="Rejected" tone="red" onUndo={() => setAction(undoAction(r.email, 'stage1', r.name ?? r.email))} />
          return <span className="text-zinc-300">—</span>
        },
      }),
      col.display({
        id: 'round2',
        header: 'Round 2 · Coding',
        size: 150,
        cell: (info) => <RoundCell cell={info.row.original.round2} />,
      }),
      col.display({
        id: 'final',
        header: 'Final decision',
        size: 170,
        enableHiding: false,
        cell: (info) => {
          const r = info.row.original
          if (r.canReleaseFinal)
            return (
              <div className="flex gap-1.5">
                <button
                  onClick={() => setAction({ title: 'Select', body: `Select ${r.name ?? r.email}? This records them as selected into the programme.`, confirmLabel: 'Select', tone: 'green', run: () => setInterviewDecision({ email: r.email, gate: 'final', decision: 'selected' }) })}
                  className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                >
                  Select
                </button>
                <button
                  onClick={() => setAction({ title: 'Reject after Round 2', body: `Reject ${r.name ?? r.email}? They'll see a rejection on their portal.`, confirmLabel: 'Reject', tone: 'red', run: () => setInterviewDecision({ email: r.email, gate: 'final', decision: 'rejected' }) })}
                  className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50"
                >
                  Reject
                </button>
              </div>
            )
          if (r.final === 'selected') return <DecisionBadge label="Selected" tone="green" onUndo={() => setAction(undoAction(r.email, 'final', r.name ?? r.email))} />
          if (r.final === 'rejected') return <DecisionBadge label="Rejected" tone="red" onUndo={() => setAction(undoAction(r.email, 'final', r.name ?? r.email))} />
          return <span className="text-zinc-300">—</span>
        },
      }),
    ],
    [],
  )

  return (
    <div className="mt-4">
      <DataTable
        data={rows}
        columns={columns}
        storageKey="interview-review"
        getRowId={(r) => r.email}
        pinnedLeft={['name']}
        searchKeys={['name', 'email']}
        searchPlaceholder="Search candidate…"
        csvFilename="interview_review"
        emptyMessage="No challenge-selected candidates yet."
      />

      {action && (
        <Modal title={action.title} onClose={() => setAction(null)}>
          <p className="text-sm text-zinc-600">{action.body}</p>
          {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setAction(null)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button
              onClick={run}
              disabled={pending}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${action.tone === 'green' ? 'bg-emerald-600 hover:bg-emerald-700' : action.tone === 'red' ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-900 hover:bg-zinc-800'}`}
            >
              {pending ? 'Working…' : action.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function DecisionBadge({ label, tone, onUndo }: { label: string; tone: 'green' | 'red'; onUndo: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone === 'green' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{label}</span>
      <button onClick={onUndo} className="text-[11px] text-zinc-400 hover:text-zinc-600 hover:underline">undo</button>
    </div>
  )
}

function undoAction(email: string, gate: 'stage1' | 'final', name: string): Pending {
  return {
    title: 'Undo decision',
    body: `Undo the ${gate === 'stage1' ? 'Round 1' : 'final'} decision for ${name}? This sends them back to awaiting review.`,
    confirmLabel: 'Undo',
    tone: 'zinc',
    run: () => undoInterviewDecision({ email, gate }),
  }
}
