'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import { setInterviewOutcome } from '../actions'
import { roundLabel, type Interview } from '@/lib/interviews'

type Row = Interview & { candidateName: string | null; interviewerName: string | null; hasNotes: boolean }

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-sky-50 text-sky-700',
  booked: 'bg-sky-50 text-sky-700',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-red-50 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
}
const REC_STYLE: Record<string, string> = {
  advance: 'bg-emerald-50 text-emerald-700',
  borderline: 'bg-amber-50 text-amber-700',
  no: 'bg-red-50 text-red-700',
}
const REC_LABEL: Record<string, string> = { advance: 'Advance', borderline: 'Borderline', no: 'Do not advance' }

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
const isUpcoming = (r: Row) => (r.status === 'booked' || r.status === 'confirmed') && new Date(r.scheduledAt).getTime() > Date.now() - 60 * 60_000

const col = createColumnHelper<Row>()

type View = 'upcoming' | 'past' | 'all'

export default function InterviewsListTable({ interviews }: { interviews: Row[] }) {
  const [view, setView] = useState<View>('upcoming')
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => {
    if (view === 'all') return interviews
    if (view === 'upcoming') return interviews.filter(isUpcoming)
    return interviews.filter((r) => !isUpcoming(r))
  }, [interviews, view])

  const columns = useMemo(
    () => [
      col.accessor((r) => r.candidateName ?? r.candidateEmail, {
        id: 'candidate',
        header: 'Candidate',
        cell: (info) => <span className="font-medium text-zinc-900">{info.getValue()}</span>,
      }),
      col.accessor((r) => roundLabel(r.round), {
        id: 'round',
        header: 'Round',
        cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
      }),
      col.accessor((r) => r.interviewerName ?? r.interviewerEmail, {
        id: 'interviewer',
        header: 'Interviewer',
        cell: (info) => <span className="text-zinc-600">{info.getValue()}</span>,
      }),
      col.accessor((r) => dayKey(r.scheduledAt), {
        id: 'when',
        header: 'When',
        sortingFn: (a, b) => a.original.scheduledAt.localeCompare(b.original.scheduledAt),
        cell: (info) => (
          <span className="whitespace-nowrap text-zinc-700">
            {dayKey(info.row.original.scheduledAt)} · <span className="tabular-nums">{timeLabel(info.row.original.scheduledAt)}</span>
          </span>
        ),
      }),
      col.accessor('status', {
        id: 'status',
        header: 'Status',
        cell: (info) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[info.getValue()] ?? 'bg-zinc-100 text-zinc-500'}`}>{info.getValue().replace('_', '-')}</span>,
      }),
      col.accessor((r) => (r.recommendation ? REC_LABEL[r.recommendation] : 'Not assessed'), {
        id: 'assessment',
        header: 'Assessment',
        cell: (info) => {
          const rec = info.row.original.recommendation
          if (!rec) return <span className="text-xs text-zinc-400">Not assessed</span>
          return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REC_STYLE[rec]}`}>{REC_LABEL[rec]}</span>
        },
      }),
      col.display({
        id: 'action',
        header: 'Notes',
        size: 240,
        enableHiding: false,
        enableColumnFilter: false,
        cell: (info) => <RowActions interview={info.row.original} onError={setError} />,
      }),
    ],
    [],
  )

  const toggle = (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
      {(['upcoming', 'past', 'all'] as View[]).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`rounded-md px-2.5 py-1 capitalize transition-colors ${view === v ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          {v}
        </button>
      ))}
    </div>
  )

  return (
    <div className="mt-4">
      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <DataTable
        data={rows}
        columns={columns}
        storageKey="interviews-list"
        getRowId={(r) => r.id}
        pinnedLeft={['candidate']}
        initialSorting={[{ id: 'when', desc: false }]}
        searchKeys={['candidateName', 'candidateEmail', 'interviewerName', 'interviewerEmail']}
        searchPlaceholder="Search candidate or interviewer…"
        csvFilename="interviews"
        toolbarLeft={toggle}
        emptyMessage={view === 'upcoming' ? 'No upcoming interviews.' : 'No interviews.'}
      />
    </div>
  )
}

// Conduct link + Done/No-show outcome buttons for a single row.
function RowActions({ interview, onError }: { interview: Row; onError: (e: string | null) => void }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const active = interview.status === 'booked' || interview.status === 'confirmed'

  function outcome(o: 'completed' | 'no_show') {
    onError(null)
    start(async () => {
      const res = await setInterviewOutcome(interview.id, o)
      if (!res.ok) onError(res.error)
      else router.refresh()
    })
  }

  // A cancelled interview with nothing captured has no useful action.
  const cancelledEmpty = interview.status === 'cancelled' && !interview.hasNotes

  return (
    <div className="flex shrink-0 items-center justify-end gap-1.5">
      {cancelledEmpty ? (
        <span className="text-xs text-zinc-300">—</span>
      ) : (
        <Link href={`/admissions/interviews/notes/${interview.id}`} className="whitespace-nowrap rounded-lg bg-[#5BAE5B] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#4e9c4e]">
          {interview.hasNotes ? 'View notes' : 'Take notes'} →
        </Link>
      )}
      {active && (
        <>
          <button onClick={() => outcome('completed')} disabled={pending} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Done</button>
          <button onClick={() => outcome('no_show')} disabled={pending} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">No-show</button>
        </>
      )}
    </div>
  )
}
