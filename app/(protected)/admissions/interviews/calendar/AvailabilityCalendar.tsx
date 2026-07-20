'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { syncWeekAvailability, setInterviewOutcome } from '../actions'
import { roundLabel, formatDateTimeIST, type InterviewSlot, type Interview } from '@/lib/interviews'

const HOUR = 60 * 60_000
const DAY = 24 * 60 * 60_000
const ROWS = 24 // one-hour cells across 24h; each cell = one 1-hour slot

type Iv = Interview & { candidateName: string | null }

// The grid is fixed to IST (the programme runs in India), independent of the
// interviewer's device timezone — so a "1 PM" cell is 1 PM IST for everyone.
const IST = 'Asia/Kolkata'
const IST_OFFSET_MS = 5.5 * 60 * 60_000 // IST = UTC+5:30, no DST

// UTC instant of Monday 00:00 IST for the week containing `base`.
function startOfWeekMondayIST(base: Date): Date {
  const ist = new Date(base.getTime() + IST_OFFSET_MS) // shift so UTC accessors read IST wall clock
  const day = (ist.getUTCDay() + 6) % 7 // Mon=0 in IST
  const mondayMidnightIstWall = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day, 0, 0, 0)
  return new Date(mondayMidnightIstWall - IST_OFFSET_MS) // IST wall clock → real UTC instant
}
const isoOf = (s: string) => new Date(s).toISOString()
const dayLabel = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: IST })
const firstName = (s: string | null | undefined, email: string) => (s ? s.split(' ')[0] : email.split('@')[0])

export default function AvailabilityCalendar({ slots, interviews, showBookings = true }: { slots: InterviewSlot[]; interviews: Iv[]; showBookings?: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [weekOffset, setWeekOffset] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Painted availability = all OPEN slot start times (ISO). paintedRef is the
  // synchronous source of truth (read on mouse-up); `painted` state drives render.
  // `published` is the last-released baseline — painting only becomes bookable on
  // Publish, so we diff painted vs published to know there are unpublished changes.
  const openSlotIsos = () => new Set(slots.filter((s) => s.status === 'open').map((s) => isoOf(s.startsAt)))
  const [painted, setPaintedState] = useState<Set<string>>(openSlotIsos)
  const [published, setPublished] = useState<Set<string>>(openSlotIsos)
  const paintedRef = useRef(painted)
  function setPainted(next: Set<string>) {
    paintedRef.current = next
    setPaintedState(next)
  }
  useEffect(() => {
    const cur = openSlotIsos()
    setPainted(cur)
    setPublished(cur) // external slot changes (e.g. a new booking) reset the baseline
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots])

  const bookedByIso = new Map<string, Iv>()
  for (const i of interviews) bookedByIso.set(isoOf(i.scheduledAt), i)

  const now = Date.now()
  const weekStart = new Date(startOfWeekMondayIST(new Date()).getTime() + weekOffset * 7 * DAY)
  const days = Array.from({ length: 7 }, (_, d) => new Date(weekStart.getTime() + d * DAY))

  const dragging = useRef(false)
  const dragMode = useRef<'add' | 'erase'>('add')

  function cellStart(dayIdx: number, row: number) {
    return new Date(weekStart.getTime() + dayIdx * DAY + row * HOUR)
  }
  function apply(iso: string, mode: 'add' | 'erase') {
    const next = new Set(paintedRef.current)
    if (mode === 'add') next.add(iso)
    else next.delete(iso)
    setPainted(next)
  }
  const ws = weekStart.getTime()
  const we = ws + 7 * DAY
  const inWeek = (iso: string) => { const t = new Date(iso).getTime(); return t >= ws && t < we }
  // Already-published open slots for this week, and what's painted now.
  const publishedThisWeek = new Set([...published].filter(inWeek))
  const paintedThisWeek = [...painted].filter(inWeek)
  // Unpublished changes = painted differs from the published baseline for this week.
  const dirty = paintedThisWeek.length !== publishedThisWeek.size || paintedThisWeek.some((iso) => !publishedThisWeek.has(iso))

  // Publish the painted availability for this week (confirmed via the popup).
  // Only this week's baseline advances, so unpublished paint on other weeks is kept.
  function publishThisWeek() {
    setConfirmOpen(false)
    setError(null)
    const releasing = paintedThisWeek
    startTransition(async () => {
      const res = await syncWeekAvailability({ weekStartIso: weekStart.toISOString(), starts: releasing })
      if (!res.ok) { setError(res.error); return }
      const nextPublished = new Set([...published].filter((iso) => !inWeek(iso)))
      releasing.forEach((iso) => nextPublished.add(iso))
      setPublished(nextPublished)
    })
  }
  // Revert this week's painting back to what's currently published.
  function discardThisWeek() {
    const next = new Set([...painted].filter((iso) => !inWeek(iso)))
    publishedThisWeek.forEach((iso) => next.add(iso))
    setPainted(next)
  }

  useEffect(() => {
    function up() { dragging.current = false } // painting stays local until Publish
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

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

  // Copy this week's painting into next week (local only — publish next week to release).
  function copyToNextWeek() {
    const shifted = paintedThisWeek.map((iso) => new Date(new Date(iso).getTime() + 7 * DAY).toISOString())
    const next = new Set(painted)
    shifted.forEach((iso) => next.add(iso))
    setPainted(next)
  }

  function outcome(id: string, o: 'completed' | 'no_show') {
    startTransition(async () => {
      const res = await setInterviewOutcome(id, o)
      if (!res.ok) setError(res.error)
      else router.refresh()
    })
  }

  const upcoming = interviews
    .filter((i) => (i.status === 'booked' || i.status === 'confirmed') && new Date(i.scheduledAt).getTime() > now - HOUR)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))

  return (
    <div className="mt-5 select-none">
      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setWeekOffset(0)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${weekOffset === 0 ? 'bg-zinc-900 text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>This week</button>
          <button onClick={() => setWeekOffset(1)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${weekOffset === 1 ? 'bg-zinc-900 text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>Next week</button>
        </div>
        <span className="text-xs text-zinc-400">Week of {days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: IST })} · IST</span>
        {dirty && <span className="text-[11px] font-semibold text-amber-600">● Unpublished changes</span>}
        <div className="ml-auto flex items-center gap-2">
          {weekOffset === 0 && (
            <button onClick={copyToNextWeek} disabled={pending} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">Copy to next week →</button>
          )}
          {dirty && (
            <button onClick={discardThisWeek} disabled={pending} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-50 disabled:opacity-50">Discard</button>
          )}
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={pending || !dirty}
            className={`rounded-lg px-3 py-1 text-xs font-semibold text-white ${dirty ? 'bg-[#5BAE5B] hover:bg-[#4e9c4e]' : 'cursor-not-allowed bg-zinc-300'}`}
          >
            {pending ? 'Publishing…' : 'Publish availability'}
          </button>
        </div>
      </div>
      <p className="mb-3 text-[11px] text-zinc-400">Paint the cells you&apos;re free, then <span className="font-medium text-zinc-500">Publish</span> to release them for booking. Nothing is bookable until you publish.</p>

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

      {/* Upcoming interviews with outcome buttons — shown for dedicated interviewers
          (staff/admin manage these from the Interviews tab). */}
      {showBookings && (
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
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">{roundLabel(i.round)}</span>
                  <span className="ml-2 text-xs text-zinc-500">{formatDateTimeIST(i.scheduledAt)}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link href={`/admissions/interviews/notes/${i.id}`} className="rounded-lg bg-[#5BAE5B] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#4e9c4e]">Conduct →</Link>
                  <button onClick={() => outcome(i.id, 'completed')} disabled={pending} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Done</button>
                  <button onClick={() => outcome(i.id, 'no_show')} disabled={pending} className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">No-show</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Publish confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-zinc-900">Publish availability?</h3>
            <p className="mt-1 text-sm text-zinc-600">
              This releases <span className="font-semibold text-zinc-900">{paintedThisWeek.length}</span> one-hour slot{paintedThisWeek.length === 1 ? '' : 's'} for the week of{' '}
              {days[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: IST })} (IST) so candidates can book them. Already-booked interviews are not affected.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirmOpen(false)} disabled={pending} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">Cancel</button>
              <button onClick={publishThisWeek} disabled={pending} className="rounded-lg bg-[#5BAE5B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4e9c4e] disabled:opacity-50">
                {pending ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
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
  const hourLabel = `${row % 12 || 12} ${row < 12 ? 'AM' : 'PM'}`
  return (
    <>
      <div className="h-8 border-r border-t border-zinc-100 pr-1 text-right text-[10px] text-zinc-400">
        {hourLabel}
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
            title={booked ? `${firstName(booked.candidateName, booked.candidateEmail)} · ${roundLabel(booked.round)}` : ''}
            className={`h-8 cursor-pointer border-l border-t border-zinc-100 ${cls} ${booked || isPast ? 'cursor-default' : ''}`}
          >
            {booked && (
              <span className="pointer-events-none block truncate px-1 text-[9px] font-semibold leading-8 text-white">
                {firstName(booked.candidateName, booked.candidateEmail)}
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}
