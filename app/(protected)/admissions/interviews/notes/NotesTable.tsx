'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import NotesReviewButton from '@/components/interviews/NotesReviewButton'
import { roundLabel } from '@/lib/interviews'
import type { ScoreRow } from '../cockpit-actions'

const REC_STYLE: Record<string, string> = {
  advance: 'bg-emerald-50 text-emerald-700',
  borderline: 'bg-amber-50 text-amber-700',
  no: 'bg-red-50 text-red-700',
}
const REC_LABEL: Record<string, string> = { advance: 'Advance', borderline: 'Borderline', no: 'Do not advance' }
// Weakest → strongest tone for a 1–4 score chip.
const SCORE_TONE = ['bg-red-100 text-red-700', 'bg-amber-100 text-amber-700', 'bg-orange-100 text-orange-700', 'bg-emerald-100 text-emerald-700']

const col = createColumnHelper<ScoreRow>()

export default function NotesTable({ rubrics, rows }: { rubrics: { key: string; label: string }[]; rows: ScoreRow[] }) {
  const columns = useMemo(
    () => [
      col.accessor((r) => r.candidateName ?? r.candidateEmail, {
        id: 'name',
        header: 'Name',
        cell: (info) => (
          <Link href={`/admissions/interviews/notes/${info.row.original.interviewId}`} className="font-medium text-zinc-900 hover:text-[#5BAE5B] hover:underline">
            {info.getValue()}
          </Link>
        ),
      }),
      col.accessor('candidateEmail', {
        id: 'email',
        header: 'Email',
        enableColumnFilter: false,
        cell: (info) => <span className="text-zinc-500">{info.getValue()}</span>,
      }),
      col.accessor((r) => roundLabel(r.round, true), {
        id: 'round',
        header: 'Round',
        cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
      }),
      col.accessor((r) => r.interviewerName ?? '', {
        id: 'interviewer',
        header: 'Interviewer',
        cell: (info) => <span className="text-zinc-600">{info.getValue() || '—'}</span>,
      }),
      col.accessor((r) => (r.recommendation ? REC_LABEL[r.recommendation] : 'Pending'), {
        id: 'assessment',
        header: 'Assessment',
        cell: (info) => {
          const rec = info.row.original.recommendation
          if (!rec) return <span className="text-xs text-zinc-400">Pending</span>
          return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REC_STYLE[rec]}`}>{REC_LABEL[rec]}</span>
        },
      }),
      // One column per active rubric — shows the 1–4 score chip.
      ...rubrics.map((rb) =>
        col.accessor((r) => r.scores[rb.key] ?? null, {
          id: `rubric_${rb.key}`,
          header: rb.label,
          size: 140,
          meta: { wrapHeader: true },
          enableColumnFilter: false,
          cell: (info) => {
            const s = info.getValue() as number | null
            if (s == null) return <span className="text-zinc-300">—</span>
            return <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[12px] font-bold ${SCORE_TONE[s - 1] ?? 'bg-zinc-100'}`}>{s}</span>
          },
        }),
      ),
      col.display({
        id: 'ai',
        header: 'AI review',
        size: 110,
        enableHiding: false,
        enableColumnFilter: false,
        cell: (info) => {
          const r = info.row.original
          // Only offer the AI check once there's something to review.
          if (!r.hasNotes) return null
          return (
            <NotesReviewButton
              interviewId={r.interviewId}
              candidateName={r.candidateName ?? r.candidateEmail}
              round={r.round}
            />
          )
        },
      }),
      col.display({
        id: 'action',
        header: 'Notes',
        size: 120,
        enableHiding: false,
        enableColumnFilter: false,
        cell: (info) => (
          <Link href={`/admissions/interviews/notes/${info.row.original.interviewId}`} className="whitespace-nowrap text-xs font-semibold text-[#5BAE5B] hover:underline">
            {info.row.original.hasNotes ? 'View notes' : 'Take notes'} →
          </Link>
        ),
      }),
    ],
    [rubrics],
  )

  return (
    <div className="mt-4">
      <DataTable
        data={rows}
        columns={columns}
        storageKey="interview-scores"
        getRowId={(r) => r.interviewId}
        pinnedLeft={['name']}
        searchKeys={['candidateName', 'candidateEmail', 'interviewerName']}
        searchPlaceholder="Search candidate or interviewer…"
        csvFilename="interview_scores"
        emptyMessage="No interviews yet."
      />
    </div>
  )
}
