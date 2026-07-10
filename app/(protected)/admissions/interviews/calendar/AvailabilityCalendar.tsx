'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { syncWeekAvailability, setInterviewOutcome } from '../actions'
import type { InterviewSlot, Interview } from '@/lib/interviews'

const HALF = 30 * 60_000
const DAY = 24 * 60 * 60_000
const ROWS = 48 // 30-min cells across 24h

type Iv = Interview & { candidateName: string | null }

function startOfWeekMonday(base: Date): Date {
  const x = new Date(base)
  x.setHours(0, 0, 0, 0)
  const day = (x.getDay() + 6) % 7 // Mon=0
  x.setDate(x.getDate() - day)
  return x
}
const isoOf = (s: string) => new Date(s).toISOString()
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
const firstName = (s: string | null | undefined, email: string) => (s ? s.split(' ')[0] : email.split('@')[0])

export default function AvailabilityCalendar({ slots, interviews }: { slots: InterviewSlot[]; interviews: Iv[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Painted availability = all OPEN slot start times (ISO), kept in sync with props.
  const [painted, setPainted] = useState<Set<string>>(() => new Set(slots.filter((s) => s.status === 'open').map((s) => isoOf(s.startsAt))))
  const paintedRef = useRef(painted)
  useEffect(() => { paintedRef.current = painted }, [painted])
  useEffect(() => {
    setPainted(new Set(slots.filter((s) => s.status === 'open').map((s) => isoOf(s.startsAt))))
  }, [slots])

  const bookedByIso = new Map<string, Iv>()
  for (const i of interviews) bookedByIso.set(isoOf(i.scheduledAt), i)

  const now = Date.now()
  const weekStart = new Date(startOfWeekMonday(new Date()).getTime() + weekOffset * 7 * DAY)
  const days = Array.from({ length: 7 }, (_, d) => new Date(weekStart.getTime() + d * DAY))

  const dragging = useRef(false)
  const dragMode = useRef<'add' | 'erase'>('add')

  function cellStart(dayIdx: number, row: number) {
    return new Date(weekStart.getTime() + dayIdx * DAY + row * HALF)
  }
  function apply(iso: string, mode: 'add' | 'erase') {
    setPainted((prev) => {
      const next = new Set(prev)
      if (mode === 'add') next.add(iso)
      else next.delete(iso)
      return next
    })
  }
  function commitWeek(nextPainted: Set<string>) {
    const ws = weekStart.getTime()
    const we = ws + 7 * DAY
    const starts = [...nextPainted].filter((iso) => {
      const t = new Date(iso).getTime()
      return t >= ws && t < we
    })
    startTransition(async () => {
      const res = await syncWeekAvailability({ weekStartIso: weekStart.toISOString(), starts })
      if (!res.ok) { setError(res.error); router.refresh() }
    })
  }

  useEffect(() => {
    function up() {
      if (dragging.current) {
        dragging.current = false
        commitWeek(paintedRef.current)
      }
    }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset])

  function onDown(dayIdx: number, row: number) {
    const start = cellStart(dayIdx, row)
    const iso = start.toISOString()
    if (bookedByIso.has(iso) || start.getTime() <= now) return
    const mode: 'add' | 'erase' = painted.has(iso) ? 'erase' : 'add'
    dragMode.current = mode
    dragging.current = true
    apply(iso, mode)
  }
  function onEnter(dayIdx: number, row: number) {
    if (!dragging.current) return
    const start = cellStart(dayIdx, row)
    const iso = start.toISOString()
    if (bookedByIso.has(iso) || start.getTime() <= now) return
    apply(iso, dragMode.current)
  }

  function copyToNextWeek() {
    const ws = weekStart.getTime()
    const we = ws + 7 * DAY
    const shifted = [...painted].filter((iso) => { const t = new Date(iso).getTime(); return t >= ws && t < we })
      .map((iso) => new Date(new Date(iso).getTime() + 7 * DAY).toISOString())
    const next = new Set(painted)
    shifted.forEach((iso) => next.add(iso))
    setPainted(next)
    const nextWeekStart = new Date(weekStart.getTime() + 7 * DAY)
    startTransition(async () => {
      const res = await syncWeekAvailability({
        weekStartIso: nextWeekStart.toISOString(),
        starts: [...next].filter((iso) => { const t = new Date(iso).getTime(); return t >= we && t < we + 7 * DAY }),
      })
      if (!res.ok) { setError(res.error); router.refresh() }
    })
  }

  function outcome(id: string, o: 'completed' | 'no_show') {
    startTransition(async () => {
      const res = await setInterviewOutcome(id, o)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  const upcoming = interviews
    .filter((i) => (i.status === 'booked' || i.status === 'confirmed') && new Date(i.scheduledAt).getTime() > now - HALF)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  return (
    <div className="mt-5 select-none">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset(0)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${weekOffset === 0 ? 'bg-zinc-900 text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>This week</button>
          <button onClick={() => setWeekOffset(1)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${weekOffset === 1 ? 'bg-zinc-900 text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>Next week</button>
        </div>
        <span className="text-xs text-zinc-400">Week of {days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        {weekOffset === 0 && (
          <button onClick={copyToNextWeek} disabled={pending} className="ml-auto rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">Copy to next week →</button>
        )}
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-[#5BAE5B]" /> available</span>
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-sky-500" /> booked</span>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {/* Grid */}
      <div className="overflow-auto rounded-xl border border-zinc-200 bg-white" style={{ maxHeight: '62vh' }}>
        <div className="grid min-w-[640px]" style={{ gridTemplateColumns: '52px repeat(7, minmax(0, 1fr))' }}>
          {/* Header */}
          <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50" />
          {days.map((d, i) => (
            <div key={i} className="sticky top-0 z-10 border-b border-l border-zinc-100 bg-zinc-50 py-1.5 text-center text-[11px] font-semibold text-zinc-600">
              {dayLabel(d)}
            </div>
          ))}

          {/* Rows */}
          {Array.from({ length: ROWS }, (_, row) => (
            <RowCells
              key={row}
              row={row}
              days={days}
              cellStart={cellStart}
              painted={painted}
              bookedByIso={bookedByIso}
              now={now}
              onDown={onDown}
              onEnter={onEnter}
            />
          ))}
        </div>
      </div>

      {/* Upcoming interviews with outcome buttons */}
      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Upcoming interviews</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">None booked yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <div className="text-sm">
                  <span className="font-semibold text-zinc-800">{i.candidateName ?? i.candidateEmail}</span>
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">Round {i.round}</span>
                  <span className="ml-2 text-xs text-zinc-500">{new Date(i.scheduledAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => outcome(i.id, 'completed')} disabled={pending} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Done</button>
                  <button onClick={() => outcome(i.id, 'no_show')} disabled={pending} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">No-show</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function RowCells({
  row, days, cellStart, painted, bookedByIso, now, onDown, onEnter,
}: {
  row: number
  days: Date[]
  cellStart: (d: number, r: number) => Date
  painted: Set<string>
  bookedByIso: Map<string, Iv>
  now: number
  onDown: (d: number, r: number) => void
  onEnter: (d: number, r: number) => void
}) {
  const onHour = row % 2 === 0
  const hh = String(Math.floor(row / 2)).padStart(2, '0')
  return (
    <>
      <div className={`h-6 border-r border-zinc-100 pr-1 text-right text-[10px] text-zinc-400 ${onHour ? 'border-t' : ''}`}>
        {onHour ? `${hh}:00` : ''}
      </div>
      {days.map((_, dayIdx) => {
        const start = cellStart(dayIdx, row)
        const iso = start.toISOString()
        const booked = bookedByIso.get(iso)
        const isPast = start.getTime() <= now
        const isAvail = painted.has(iso)
        let cls = 'bg-white hover:bg-zinc-50'
        if (booked) cls = 'bg-sky-500'
        else if (isAvail) cls = 'bg-[#5BAE5B] hover:bg-[#4e9c4e]'
        else if (isPast) cls = 'bg-zinc-50'
        return (
          <div
            key={dayIdx}
            onMouseDown={() => onDown(dayIdx, row)}
            onMouseEnter={() => onEnter(dayIdx, row)}
            title={booked ? `${firstName(booked.candidateName, booked.candidateEmail)} · Round ${booked.round}` : ''}
            className={`h-6 cursor-pointer border-l border-zinc-100 ${onHour ? 'border-t' : ''} ${cls} ${booked || isPast ? 'cursor-default' : ''}`}
          >
            {booked && (
              <span className="pointer-events-none block truncate px-1 text-[9px] font-semibold leading-6 text-white">
                {firstName(booked.candidateName, booked.candidateEmail)}
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}
