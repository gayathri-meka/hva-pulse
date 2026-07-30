'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import NotesReviewButton from '@/components/interviews/NotesReviewButton'
import type { Interview } from '@/lib/interviews'
import { scoreTone, formatScore } from '@/lib/interviewCockpit'
import { usePersistentState } from '@/hooks/usePersistentState'
import type { ScoreRow } from '../cockpit-actions'
import type { InterviewReviewTableRow } from '../review-actions'

type BookedInterview = Interview & { candidateName: string | null; interviewerName: string | null; hasNotes: boolean }
type Row = {
  id: string
  interviewId: string | null
  candidateName: string | null
  candidateEmail: string
  round: 1 | 2 | null
  interviewerName: string | null
  scheduledAt: string | null
  status: string
  recommendation: string | null
  scores: Record<string, number>
  hasNotes: boolean
}
type View = 'upcoming' | 'completed' | 'not_scheduled' | 'all'

const col = createColumnHelper<Row>()
const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-sky-50 text-sky-700', booked: 'bg-sky-50 text-sky-700',
  completed: 'bg-emerald-50 text-emerald-700', no_show: 'bg-red-50 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500', not_scheduled: 'bg-amber-50 text-amber-700',
}
const REC_STYLE: Record<string, string> = { advance: 'bg-emerald-50 text-emerald-700', borderline: 'bg-amber-50 text-amber-700', no: 'bg-red-50 text-red-700' }
const REC_LABEL: Record<string, string> = { advance: 'Advance', borderline: 'Borderline', no: 'Do not advance' }
const TONE_CHIP: Record<string, string> = { red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', orange: 'bg-orange-100 text-orange-700', emerald: 'bg-emerald-100 text-emerald-700' }
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })

export default function InterviewsListTable({ interviews, rubrics = [], scoreRows = [], candidates = [] }: {
  interviews: BookedInterview[]
  rubrics?: { key: string; label: string }[]
  scoreRows?: ScoreRow[]
  candidates?: InterviewReviewTableRow[]
}) {
  const router = useRouter()
  const [view, setView] = usePersistentState<View>('admissions-interviews-list:view', 'upcoming', {
    validate: (value): value is View => typeof value === 'string' && ['upcoming', 'completed', 'not_scheduled', 'all'].includes(value),
  })

  const allRows = useMemo(() => {
    const scoreById = new Map(scoreRows.map((r) => [r.interviewId, r]))
    const scheduledEmails = new Set(interviews.filter((r) => r.status !== 'cancelled').map((r) => r.candidateEmail.toLowerCase()))
    const booked: Row[] = interviews.map((r) => {
      const score = scoreById.get(r.id)
      return { id: r.id, interviewId: r.id, candidateName: r.candidateName, candidateEmail: r.candidateEmail, round: r.round,
        interviewerName: r.interviewerName, scheduledAt: r.scheduledAt, status: r.status, recommendation: r.recommendation ?? null,
        scores: score?.scores ?? {}, hasNotes: score?.hasNotes ?? r.hasNotes }
    })
    const unscheduled: Row[] = candidates
      .filter((r) => !scheduledEmails.has(r.email.toLowerCase()))
      .map((r) => ({ id: `not-scheduled:${r.email}`, interviewId: null, candidateName: r.name, candidateEmail: r.email,
        round: null, interviewerName: null, scheduledAt: null, status: 'not_scheduled', recommendation: null, scores: {}, hasNotes: false }))
    return [...booked, ...unscheduled]
  }, [interviews, scoreRows, candidates])

  const rows = useMemo(() => {
    if (view === 'all') return allRows
    if (view === 'not_scheduled') return allRows.filter((r) => r.status === 'not_scheduled')
    if (view === 'completed') return allRows.filter((r) => r.status === 'completed')
    return allRows.filter((r) => (r.status === 'booked' || r.status === 'confirmed') && !!r.scheduledAt && new Date(r.scheduledAt).getTime() > Date.now() - 60 * 60_000)
  }, [allRows, view])

  const columns = useMemo(() => [
    col.accessor((r) => r.candidateName ?? r.candidateEmail, { id: 'candidate', header: 'Candidate', cell: (i) => <span className="font-medium text-zinc-900">{i.getValue()}</span> }),
    col.accessor('candidateEmail', { id: 'email', header: 'Email', cell: (i) => <span className="text-zinc-500">{i.getValue()}</span> }),
    col.accessor((r) => r.interviewerName ?? '—', { id: 'interviewer', header: 'Interviewer', cell: (i) => <span className="text-zinc-600">{i.getValue()}</span> }),
    col.accessor((r) => r.scheduledAt ? dayKey(r.scheduledAt) : '—', { id: 'when', header: 'When', sortingFn: (a, b) => (a.original.scheduledAt ?? '').localeCompare(b.original.scheduledAt ?? ''), cell: (i) => i.row.original.scheduledAt ? <span className="whitespace-nowrap text-zinc-700">{dayKey(i.row.original.scheduledAt)} · {timeLabel(i.row.original.scheduledAt)}</span> : <span className="text-zinc-300">—</span> }),
    col.accessor('status', { id: 'status', header: 'Interview Status', cell: (i) => <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[i.getValue()] ?? 'bg-zinc-100 text-zinc-500'}`}>{i.getValue().replaceAll('_', ' ')}</span> }),
    col.accessor((r) => r.recommendation ? REC_LABEL[r.recommendation] : 'Pending', { id: 'verdict', header: 'Verdict', cell: (i) => i.row.original.recommendation ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REC_STYLE[i.row.original.recommendation]}`}>{i.getValue()}</span> : <span className="text-xs text-zinc-400">Pending</span> }),
    col.accessor((r) => r.hasNotes ? 'Available' : 'Not added', { id: 'notes', header: 'Notes', cell: (i) => <span className="text-xs text-zinc-500">{i.getValue()}</span> }),
    col.display({ id: 'ai', header: 'AI review', size: 110, enableHiding: false, enableColumnFilter: false, cell: (i) => i.row.original.interviewId && i.row.original.hasNotes && i.row.original.round ? <div onClick={(e) => e.stopPropagation()}><NotesReviewButton interviewId={i.row.original.interviewId} candidateName={i.row.original.candidateName ?? i.row.original.candidateEmail} round={i.row.original.round} /></div> : <span className="text-zinc-300">—</span> }),
    ...rubrics.filter((rb) => rb.key !== 'reading_comprehension' && rb.label.toLowerCase() !== 'reading comprehension').map((rb) => col.accessor((r) => r.scores[rb.key] ?? null, { id: `rubric_${rb.key}`, header: rb.label === 'Comprehension' ? 'Listening Comprehension' : rb.label, size: 140, meta: { wrapHeader: true }, enableColumnFilter: false, cell: (i) => { const score = i.getValue() as number | null; return score == null ? <span className="text-zinc-300">—</span> : <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded px-1 text-[12px] font-bold ${TONE_CHIP[scoreTone(score)]}`}>{formatScore(score)}</span> } })),
  ], [rubrics])

  const tabs: { value: View; label: string }[] = [{ value: 'upcoming', label: 'Upcoming' }, { value: 'completed', label: 'Completed' }, { value: 'not_scheduled', label: 'Not Scheduled' }, { value: 'all', label: 'All' }]
  const toggle = <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">{tabs.map((tab) => <button key={tab.value} onClick={() => setView(tab.value)} className={`rounded-md px-2.5 py-1 transition-colors ${view === tab.value ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'}`}>{tab.label}</button>)}</div>

  return <div className="mt-4"><DataTable data={rows} columns={columns} storageKey="personal-interviews" getRowId={(r) => r.id} pinnedLeft={['candidate', 'email']} initialSorting={[{ id: 'when', desc: false }]} searchKeys={['candidateName', 'candidateEmail', 'interviewerName']} searchPlaceholder="Search candidate, email or interviewer…" csvFilename="personal_interviews" toolbarLeft={toggle} emptyMessage={`No ${tabs.find((t) => t.value === view)?.label.toLowerCase()} interviews.`} onRowClick={(row) => { if (row.interviewId) router.push(`/admissions/interviews/notes/${row.interviewId}`) }} rowClassName={(row) => row.interviewId ? '' : 'cursor-default'} /></div>
}
