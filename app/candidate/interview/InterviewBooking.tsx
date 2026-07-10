'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { IconCheck } from '@tabler/icons-react'
import { bookSlot, type BookingState } from './actions'
import type { InterviewSlot, Interview } from '@/lib/interviews'

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function RoundCard({ interview }: { interview: Interview }) {
  const done = interview.status === 'completed'
  return (
    <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-zinc-900">Round {interview.round}</div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${done ? 'bg-emerald-50 text-emerald-700' : interview.status === 'no_show' ? 'bg-zinc-100 text-zinc-500' : 'bg-sky-50 text-sky-700'}`}>
          {done ? 'Completed' : interview.status === 'no_show' ? 'Missed' : 'Confirmed'}
        </span>
      </div>
      <div className="mt-1.5 text-sm text-zinc-600">{dayLabel(interview.scheduledAt)} · {timeLabel(interview.scheduledAt)}</div>
      {interview.meetLink && (
        <a href={interview.meetLink} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-sky-600 hover:text-sky-700">Join Google Meet →</a>
      )}
    </div>
  )
}

export default function InterviewBooking({ state }: { state: BookingState }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const booked = state.interviews.filter((i) => i.status !== 'cancelled').sort((a, b) => a.round - b.round)

  // Group open slots by day.
  const byDay = useMemo(() => {
    const m = new Map<string, InterviewSlot[]>()
    for (const s of state.openSlots) {
      const k = dayLabel(s.startsAt)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(s)
    }
    return [...m.entries()]
  }, [state.openSlots])

  function book(slotId: string) {
    setError(null)
    startTransition(async () => {
      const res = await bookSlot(slotId)
      if (!res.ok) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-5">
      {booked.map((i) => <RoundCard key={i.id} interview={i} />)}

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {state.nextRound === null ? (
        booked.length > 0 && booked.every((i) => i.status === 'completed') ? (
          <div className="flex items-center gap-2 rounded-2xl border-[0.5px] border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
            <IconCheck size={18} /> Both interviews done — we&apos;ll be in touch with the outcome.
          </div>
        ) : (
          <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            {booked.some((i) => i.round === 1 && i.status !== 'completed')
              ? 'Once your first interview is done, your second round will open up here.'
              : 'Nothing to book right now.'}
          </div>
        )
      ) : (
        <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-5">
          <div className="mb-3 text-sm font-bold text-zinc-900">Pick a slot for Round {state.nextRound}</div>
          {byDay.length === 0 ? (
            <p className="text-sm text-zinc-500">No slots are open right now. Please check back soon — we&apos;re adding availability.</p>
          ) : (
            <div className="space-y-4">
              {byDay.map(([day, slots]) => (
                <div key={day}>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">{day}</div>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => book(s.id)}
                        disabled={pending}
                        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:border-[#5BAE5B] hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {timeLabel(s.startsAt)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
