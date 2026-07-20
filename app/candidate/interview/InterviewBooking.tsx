'use client'

import { useMemo, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { IconCheck, IconVideo, IconClock } from '@tabler/icons-react'
import { bookSlot, cancelMyInterview, type BookingState } from './actions'
import { roundLabel, type InterviewSlot, type Interview } from '@/lib/interviews'

const jakarta = { fontFamily: 'var(--font-jakarta), sans-serif' } as const

// All times are shown in IST (the programme runs in India) — pin the timezone so
// the candidate sees the same time regardless of their device's timezone.
const IST = 'Asia/Kolkata'
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: IST }) // YYYY-MM-DD (IST)
const weekday = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', timeZone: IST })
const dayNum = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', timeZone: IST })
const monthShort = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', timeZone: IST })
const fullDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: IST })
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST })

// A "quick add" Google Calendar link so the candidate can drop the interview onto
// their own calendar in one click (needed since external invites don't auto-add).
function gcalUrl(interview: Interview): string {
  const start = new Date(interview.scheduledAt)
  const end = new Date(start.getTime() + 60 * 60_000)
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') // YYYYMMDDTHHmmssZ (UTC)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `HVA Interview · ${roundLabel(interview.round)}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: interview.meetLink ? `Join the interview: ${interview.meetLink}` : 'HyperVerge Academy admissions interview.',
    ctz: IST,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export default function InterviewBooking({ state }: { state: BookingState }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const booked = state.interviews.filter((i) => i.status !== 'cancelled').sort((a, b) => a.round - b.round)

  // Open slots grouped by local calendar day (future only), ordered.
  const days = useMemo(() => {
    const m = new Map<string, InterviewSlot[]>()
    for (const s of [...state.openSlots].sort((a, b) => a.startsAt.localeCompare(b.startsAt))) {
      const k = dayKey(s.startsAt)
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(s)
    }
    return [...m.entries()].map(([key, slots]) => ({ key, slots }))
  }, [state.openSlots])

  // Default-select the first available day.
  useEffect(() => {
    if (state.nextRound && days.length && !days.some((d) => d.key === selectedDay)) {
      setSelectedDay(days[0].key)
      setSelectedSlot(null)
    }
  }, [days, state.nextRound, selectedDay])

  const daySlots = days.find((d) => d.key === selectedDay)?.slots ?? []
  const chosen = state.openSlots.find((s) => s.id === selectedSlot)

  function book() {
    if (!selectedSlot) return
    setError(null)
    startTransition(async () => {
      const res = await bookSlot(selectedSlot)
      if (!res.ok) { setError(res.error); return }
      setSelectedSlot(null)
      router.refresh()
    })
  }
  function reschedule(id: string) {
    setError(null)
    startTransition(async () => {
      const res = await cancelMyInterview(id)
      if (!res.ok) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {booked.map((i) => <RoundCard key={i.id} interview={i} onReschedule={reschedule} pending={pending} />)}

      {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {state.nextRound === null ? (
        state.final === 'selected' ? (
          <div className="rounded-2xl border-[0.5px] border-emerald-200 bg-[#f0fdf4] p-5">
            <div className="text-sm font-extrabold text-[#166534]">You&apos;re through! 🎉</div>
            <p className="mt-1 text-sm text-emerald-800">You&apos;ve cleared the interviews. Head to the <strong>Selection</strong> tab for what happens next.</p>
          </div>
        ) : state.stage1 === 'rejected' || state.final === 'rejected' ? (
          <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-5">
            <div className="text-sm font-extrabold text-zinc-900">Thank you for interviewing with us</div>
            <p className="mt-1 text-sm leading-relaxed text-zinc-600">
              We really appreciate the time you gave us. After careful review, we won&apos;t be moving forward with your
              application at this stage. We wish you the very best, and we&apos;d welcome you to apply again in the future.
            </p>
          </div>
        ) : state.awaitingReview ? (
          <div className="flex items-start gap-2 rounded-2xl border-[0.5px] border-amber-200 bg-amber-50/60 p-5 text-sm text-amber-800">
            <IconClock size={18} className="mt-0.5 shrink-0" />
            <span>Thanks for interviewing — the team is reviewing it now. We&apos;ll update you right here as soon as there&apos;s news.</span>
          </div>
        ) : booked.length > 0 && booked.every((i) => i.status === 'completed') ? (
          <div className="flex items-center gap-2 rounded-2xl border-[0.5px] border-emerald-200 bg-[#f0fdf4] p-5 text-sm text-emerald-800">
            <IconCheck size={18} /> You&apos;re all set — both interviews done. We&apos;ll be in touch with the outcome.
          </div>
        ) : (
          <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-5 text-sm text-zinc-600">
            {booked.some((i) => i.round === 1 && i.status !== 'completed')
              ? 'Your Round 2 (Coding) slot will open up here once your first interview is done.'
              : 'Nothing to book right now.'}
          </div>
        )
      ) : (
        <Picker
          round={state.nextRound}
          days={days}
          daySlots={daySlots}
          selectedDay={selectedDay}
          selectedSlot={selectedSlot}
          chosen={chosen}
          pending={pending}
          onPickDay={(k) => { setSelectedDay(k); setSelectedSlot(null) }}
          onPickSlot={setSelectedSlot}
          onBook={book}
        />
      )}
    </div>
  )
}

function RoundCard({ interview, onReschedule, pending }: { interview: Interview; onReschedule: (id: string) => void; pending: boolean }) {
  const done = interview.status === 'completed'
  const noShow = interview.status === 'no_show'
  const upcoming = (interview.status === 'confirmed' || interview.status === 'booked') && new Date(interview.scheduledAt).getTime() > Date.now()
  return (
    <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-extrabold text-zinc-900">{roundLabel(interview.round)}</div>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${done ? 'bg-emerald-50 text-emerald-700' : noShow ? 'bg-zinc-100 text-zinc-500' : 'bg-sky-50 text-sky-700'}`}>
          {done ? 'Completed' : noShow ? 'Missed' : 'Confirmed'}
        </span>
      </div>
      <div className="mt-1.5 text-[15px] font-bold text-zinc-900" style={jakarta}>{fullDay(interview.scheduledAt)}</div>
      <div className="text-sm text-zinc-600">{timeLabel(interview.scheduledAt)} · 1 hour · IST</div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {interview.meetLink && (
          <a href={interview.meetLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#0f1f0f] px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[#15301a]">
            <IconVideo size={15} /> Join Google Meet
          </a>
        )}
        {upcoming && (
          <a href={gcalUrl(interview)} target="_blank" rel="noreferrer" className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-[13px] font-bold text-zinc-700 transition-colors hover:border-[#5BAE5B] hover:bg-[#f0fdf4]">
            Add to calendar
          </a>
        )}
        {upcoming && (
          <button
            onClick={() => onReschedule(interview.id)}
            disabled={pending}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-[13px] font-bold text-zinc-700 transition-colors hover:border-[#5BAE5B] hover:bg-[#f0fdf4] disabled:opacity-50"
          >
            Reschedule
          </button>
        )}
      </div>
    </div>
  )
}

function Picker({
  round, days, daySlots, selectedDay, selectedSlot, chosen, pending, onPickDay, onPickSlot, onBook,
}: {
  round: 1 | 2
  days: { key: string; slots: InterviewSlot[] }[]
  daySlots: InterviewSlot[]
  selectedDay: string | null
  selectedSlot: string | null
  chosen: InterviewSlot | undefined
  pending: boolean
  onPickDay: (k: string) => void
  onPickSlot: (id: string) => void
  onBook: () => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border-[0.5px] border-zinc-200 bg-white">
      <div className="border-b border-zinc-100 px-5 pb-4 pt-6 sm:pt-7">
        <div className="text-[17px] font-black text-zinc-900" style={jakarta}>Book your {roundLabel(round)} interview</div>
        <p className="mt-0.5 text-[13px] leading-[1.5] text-zinc-500">A 1-hour video call with the HVA team. Pick a day and time that works for you.</p>
      </div>

      {days.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-zinc-500">
          No times are open right now — we&apos;re adding availability. Please check back soon.
        </div>
      ) : (
        <>
          {/* Day pills */}
          <div className="flex gap-2 overflow-x-auto px-5 pb-1 pt-4">
            {days.map(({ key, slots }) => {
              const iso = slots[0].startsAt
              const active = key === selectedDay
              return (
                <button
                  key={key}
                  onClick={() => onPickDay(key)}
                  className={`flex min-w-[58px] shrink-0 flex-col items-center rounded-2xl border px-2.5 py-2 transition-colors ${
                    active ? 'border-[#5BAE5B] bg-[#f0fdf4]' : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <span className={`text-[11px] font-bold uppercase ${active ? 'text-[#166534]' : 'text-zinc-400'}`}>{weekday(iso)}</span>
                  <span className={`text-[19px] font-black leading-tight ${active ? 'text-[#166534]' : 'text-zinc-900'}`} style={jakarta}>{dayNum(iso)}</span>
                  <span className={`text-[10px] font-semibold ${active ? 'text-[#16a34a]' : 'text-zinc-400'}`}>{monthShort(iso)}</span>
                  <span className={`mt-0.5 text-[10px] font-bold ${active ? 'text-[#16a34a]' : 'text-zinc-300'}`}>{slots.length} slot{slots.length === 1 ? '' : 's'}</span>
                </button>
              )
            })}
          </div>

          {/* Time chips */}
          <div className="px-5 pb-4 pt-3">
            <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-zinc-700">
              <IconClock size={15} className="text-[#16a34a]" />
              {selectedDay ? fullDay(daySlots[0]?.startsAt ?? '') : 'Pick a day'}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {daySlots.map((s) => {
                const active = s.id === selectedSlot
                return (
                  <button
                    key={s.id}
                    onClick={() => onPickSlot(s.id)}
                    className={`rounded-xl border px-2 py-2.5 text-[14px] font-bold transition-colors ${
                      active ? 'border-[#5BAE5B] bg-[#5BAE5B] text-white' : 'border-zinc-200 bg-white text-zinc-700 hover:border-[#5BAE5B] hover:bg-[#f0fdf4]'
                    }`}
                  >
                    {timeLabel(s.startsAt)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Confirm */}
          <div className="border-t border-zinc-100 p-4">
            <button
              onClick={onBook}
              disabled={!selectedSlot || pending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1f0f] px-6 py-4 text-[15px] font-extrabold text-white transition-all hover:bg-[#15301a] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {pending
                ? 'Booking…'
                : chosen
                  ? <>Confirm · {new Date(chosen.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: IST })}, {timeLabel(chosen.startsAt)} <span aria-hidden>→</span></>
                  : 'Pick a time to confirm'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
