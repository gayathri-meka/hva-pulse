'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addInterviewer, removeInterviewer, setInterviewerRound, type InterviewerRow } from './actions'
import { computeInterviewMetrics, roundLabel, formatDateTimeIST, type InterviewSlot, type Interview } from '@/lib/interviews'

const ROUND_STYLE: Record<number, string> = {
  1: 'bg-violet-50 text-violet-700 ring-violet-200',
  2: 'bg-amber-50 text-amber-700 ring-amber-200',
}

type IvRow = Interview & { candidateName: string | null; interviewerName: string | null; hasNotes: boolean }

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-sky-50 text-sky-700',
  booked: 'bg-sky-50 text-sky-700',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-red-50 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
}

const fmt = formatDateTimeIST

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <div className={`text-2xl font-bold ${tone ?? 'text-zinc-900'}`}>{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  )
}

export default function InterviewsAdmin({
  interviewers,
  slots,
  interviews,
  isAdmin,
}: {
  interviewers: InterviewerRow[]
  slots: InterviewSlot[]
  interviews: IvRow[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [round, setRound] = useState<1 | 2>(1)
  const [error, setError] = useState<string | null>(null)

  const m = computeInterviewMetrics(slots, interviews)

  function add() {
    if (!email.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addInterviewer({ email, name, round })
      if (!res.ok) { setError(res.error); return }
      setEmail(''); setName(''); setRound(1)
      router.refresh()
    })
  }
  function changeRound(e: string, r: 1 | 2) {
    setError(null)
    startTransition(async () => {
      const res = await setInterviewerRound({ email: e, round: r })
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }
  function remove(e: string) {
    startTransition(async () => {
      const res = await removeInterviewer(e)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Open slots" value={m.slotsOpen} />
        <Metric label="Scheduled" value={m.scheduled} tone="text-sky-600" />
        <Metric label="Completed" value={m.completed} tone="text-emerald-600" />
        <Metric label="No-shows" value={m.noShow} tone="text-red-600" />
        <Metric label="Show rate" value={m.showRatePct == null ? '—' : `${m.showRatePct}%`} />
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Interviewers */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Interviewers</h2>
        {isAdmin && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-[#5BAE5B] focus:outline-none" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@hyperverge.co" className="min-w-[220px] flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-[#5BAE5B] focus:outline-none" />
            <select value={round} onChange={(e) => setRound(Number(e.target.value) as 1 | 2)} title="Which round this interviewer runs" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-[#5BAE5B] focus:outline-none">
              <option value={1}>Motivation panel</option>
              <option value={2}>Coding panel</option>
            </select>
            <button onClick={add} disabled={pending || !email.trim()} className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e9c4e] disabled:opacity-50">Add interviewer</button>
          </div>
        )}
        <p className="mt-1.5 text-[11px] text-zinc-400">Each interviewer runs one panel. Their published availability is only offered to candidates on that round.</p>
        {interviewers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No interviewers yet. {isAdmin ? 'Add one above — they sign in with Google and publish their availability.' : 'An admin can add interviewers.'}</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                <th className="py-1.5 font-medium">Name</th><th className="py-1.5 font-medium">Email</th>
                <th className="py-1.5 font-medium">Panel</th>
                <th className="py-1.5 text-right font-medium">Open</th><th className="py-1.5 text-right font-medium">Booked</th>
                <th className="py-1.5 text-right font-medium">Done</th>{isAdmin && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {interviewers.map((iv) => (
                <tr key={iv.email}>
                  <td className="py-1.5 text-zinc-800">{iv.name ?? '—'}</td>
                  <td className="py-1.5 text-zinc-500">{iv.email}</td>
                  <td className="py-1.5">
                    {isAdmin ? (
                      <select
                        value={iv.round ?? ''}
                        onChange={(e) => changeRound(iv.email, Number(e.target.value) as 1 | 2)}
                        disabled={pending}
                        title="Which round this interviewer runs"
                        className={`rounded-md border-0 px-1.5 py-0.5 text-[11px] font-semibold ring-1 focus:outline-none ${iv.round ? ROUND_STYLE[iv.round] : 'bg-zinc-100 text-zinc-500 ring-zinc-200'}`}
                      >
                        <option value="" disabled>Set panel…</option>
                        <option value={1}>Motivation</option>
                        <option value={2}>Coding</option>
                      </select>
                    ) : iv.round ? (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${ROUND_STYLE[iv.round]}`}>{roundLabel(iv.round, true)}</span>
                    ) : (
                      <span className="text-[11px] text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-600">{iv.openSlots}</td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-600">{iv.booked}</td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-600">{iv.completed}</td>
                  {isAdmin && (
                    <td className="py-1.5 text-right">
                      <button onClick={() => remove(iv.email)} disabled={pending} className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50">Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* All interviews */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Interviews</h2>
        {interviews.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No interviews booked yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                <th className="py-1.5 font-medium">Candidate</th><th className="py-1.5 font-medium">Round</th>
                <th className="py-1.5 font-medium">Interviewer</th><th className="py-1.5 font-medium">When</th>
                <th className="py-1.5 font-medium">Status</th><th />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {interviews.map((i) => (
                <tr key={i.id}>
                  <td className="py-1.5 text-zinc-800">{i.candidateName ?? i.candidateEmail}</td>
                  <td className="py-1.5 text-zinc-600">{roundLabel(i.round, true)}</td>
                  <td className="py-1.5 text-zinc-600">{i.interviewerName ?? i.interviewerEmail}</td>
                  <td className="py-1.5 text-zinc-600">{fmt(i.scheduledAt)}</td>
                  <td className="py-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[i.status] ?? 'bg-zinc-100 text-zinc-500'}`}>{i.status.replace('_', '-')}</span></td>
                  <td className="py-1.5 text-right">
                    {i.status === 'cancelled' && !i.hasNotes ? (
                      <span className="text-xs text-zinc-300">—</span>
                    ) : (
                      <Link href={`/admissions/interviews/notes/${i.id}`} className="text-xs font-medium text-[#5BAE5B] hover:underline">
                        {i.hasNotes ? 'View notes' : 'Take notes'} →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
