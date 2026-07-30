'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addInterviewer, removeInterviewer, setInterviewerRound, type InterviewerRow } from './actions'
import { computeInterviewMetrics, roundLabel, type InterviewSlot, type Interview } from '@/lib/interviews'

const ROUND_STYLE: Record<number, string> = {
  1: 'bg-violet-50 text-violet-700 ring-violet-200',
  2: 'bg-amber-50 text-amber-700 ring-amber-200',
}

// Native <select> renders with OS chrome that clashes with our rounded inputs —
// strip it (appearance-none) and draw our own chevron so it matches the boxes.
function PanelSelect({
  value,
  onChange,
  disabled,
  size = 'md',
}: {
  value: number | ''
  onChange: (v: 1 | 2) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const dims = size === 'sm' ? 'px-2 py-1 pr-7 text-xs' : 'px-2.5 py-1.5 pr-8 text-sm'
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as 1 | 2)}
        disabled={disabled}
        title="Which round this interviewer runs"
        className={`appearance-none rounded-lg border border-zinc-300 bg-white text-zinc-700 focus:border-[#5BAE5B] focus:outline-none disabled:opacity-50 ${dims}`}
      >
        {value === '' && <option value="" disabled>Set panel…</option>}
        <option value={1}>Motivation panel</option>
        <option value={2}>Coding panel</option>
      </select>
      <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400">
        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" />
      </svg>
    </div>
  )
}

type IvRow = Interview & { candidateName: string | null; interviewerName: string | null; hasNotes: boolean }

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
            <PanelSelect value={round} onChange={setRound} />
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
                      <PanelSelect value={iv.round ?? ''} onChange={(v) => changeRound(iv.email, v)} disabled={pending} size="sm" />
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
    </div>
  )
}
