'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addInterviewer, removeInterviewer, type InterviewerRow } from './actions'
import { computeInterviewMetrics, type InterviewSlot, type Interview } from '@/lib/interviews'

type IvRow = Interview & { candidateName: string | null; interviewerName: string | null }

const STATUS_STYLE: Record<string, string> = {
  confirmed: 'bg-sky-50 text-sky-700',
  booked: 'bg-sky-50 text-sky-700',
  completed: 'bg-emerald-50 text-emerald-700',
  no_show: 'bg-red-50 text-red-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

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
  const [error, setError] = useState<string | null>(null)

  const m = computeInterviewMetrics(slots, interviews)

  function add() {
    if (!email.trim()) return
    setError(null)
    startTransition(async () => {
      const res = await addInterviewer({ email, name })
      if (!res.ok) { setError(res.error); return }
      setEmail(''); setName('')
      router.refresh()
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Metric label="Open slots" value={m.slotsOpen} />
        <Metric label="Booked slots" value={m.slotsBooked} />
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
            <button onClick={add} disabled={pending || !email.trim()} className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e9c4e] disabled:opacity-50">Add interviewer</button>
          </div>
        )}
        {interviewers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-400">No interviewers yet. {isAdmin ? 'Add one above — they sign in with Google and publish their availability.' : 'An admin can add interviewers.'}</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400">
                <th className="py-1.5 font-medium">Name</th><th className="py-1.5 font-medium">Email</th>
                <th className="py-1.5 text-right font-medium">Open</th><th className="py-1.5 text-right font-medium">Booked</th>
                <th className="py-1.5 text-right font-medium">Done</th>{isAdmin && <th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {interviewers.map((iv) => (
                <tr key={iv.email}>
                  <td className="py-1.5 text-zinc-800">{iv.name ?? '—'}</td>
                  <td className="py-1.5 text-zinc-500">{iv.email}</td>
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
                <th className="py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {interviews.map((i) => (
                <tr key={i.id}>
                  <td className="py-1.5 text-zinc-800">{i.candidateName ?? i.candidateEmail}</td>
                  <td className="py-1.5 text-zinc-600">R{i.round}</td>
                  <td className="py-1.5 text-zinc-600">{i.interviewerName ?? i.interviewerEmail}</td>
                  <td className="py-1.5 text-zinc-600">{fmt(i.scheduledAt)}</td>
                  <td className="py-1.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[i.status] ?? 'bg-zinc-100 text-zinc-500'}`}>{i.status.replace('_', '-')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
