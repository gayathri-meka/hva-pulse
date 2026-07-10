'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishSlot, deleteSlot, setInterviewOutcome } from './actions'
import type { InterviewSlot, Interview } from '@/lib/interviews'

const DURATIONS = [30, 45, 60]

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function InterviewerClient({
  slots,
  interviews,
  nameByEmail,
}: {
  slots: InterviewSlot[]
  interviews: Interview[]
  nameByEmail: Record<string, string>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [start, setStart] = useState('')
  const [duration, setDuration] = useState(45)
  const [error, setError] = useState<string | null>(null)

  const now = Date.now()
  const upcoming = interviews.filter((i) => i.status === 'booked' || i.status === 'confirmed')
  const past = interviews.filter((i) => i.status === 'completed' || i.status === 'no_show')
  const openSlots = slots.filter((s) => s.status === 'open' && new Date(s.startsAt).getTime() > now)

  function addSlot() {
    if (!start) return
    setError(null)
    const startsAt = new Date(start).toISOString()
    const endsAt = new Date(new Date(start).getTime() + duration * 60_000).toISOString()
    startTransition(async () => {
      const res = await publishSlot({ startsAt, endsAt })
      if (!res.ok) { setError(res.error); return }
      setStart('')
      router.refresh()
    })
  }
  function removeSlot(id: string) {
    startTransition(async () => {
      const res = await deleteSlot(id)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }
  function outcome(id: string, o: 'completed' | 'no_show') {
    startTransition(async () => {
      const res = await setInterviewOutcome(id, o)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="mt-6 space-y-6">
      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Upcoming interviews */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Upcoming interviews</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No interviews booked yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((i) => (
              <li key={i.id} className="rounded-lg border border-zinc-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-800">
                      {nameByEmail[i.candidateEmail] ?? i.candidateEmail}
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Round {i.round}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">{fmt(i.scheduledAt)}</div>
                    {i.meetLink && (
                      <a href={i.meetLink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-medium text-sky-600 hover:text-sky-700">
                        Join Google Meet →
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => outcome(i.id, 'completed')} disabled={pending} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Done</button>
                    <button onClick={() => outcome(i.id, 'no_show')} disabled={pending} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">No-show</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Availability */}
      <section className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Your availability</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Start</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500">Duration</span>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm text-zinc-800 focus:border-[#5BAE5B] focus:outline-none">
              {DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
          <button onClick={addSlot} disabled={pending || !start} className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#4e9c4e] disabled:opacity-50">Add slot</button>
        </div>

        {openSlots.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-400">No open slots. Add availability above and candidates can book it.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {openSlots.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-zinc-700">{fmt(s.startsAt)} – {fmtTime(s.endsAt)}</span>
                <button onClick={() => removeSlot(s.id)} disabled={pending} className="text-xs text-zinc-400 hover:text-red-600 disabled:opacity-50">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Past */}
      {past.length > 0 && (
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Past</h2>
          <ul className="mt-3 divide-y divide-zinc-100">
            {past.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-zinc-700">{nameByEmail[i.candidateEmail] ?? i.candidateEmail} · R{i.round} · {fmt(i.scheduledAt)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${i.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                  {i.status === 'completed' ? 'Completed' : 'No-show'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
