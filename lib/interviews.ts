// Interview scheduling — shared types + pure logic (metrics, booking rules).
// Two SEQUENTIAL rounds per candidate; identity is the normalised email.

export const INTERVIEW_ROUNDS = [1, 2] as const
export type InterviewRound = (typeof INTERVIEW_ROUNDS)[number]

// "Sun, Jul 19 at 1:30 AM" in IST. Assembled from formatToParts with a FIXED
// separator — toLocaleString's own separator (", " vs " at ") differs between
// Node's ICU (server) and the browser's ICU (client), which breaks hydration.
export function formatDateTimeIST(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  }).formatToParts(new Date(iso))
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${g('weekday')}, ${g('month')} ${g('day')} at ${g('hour')}:${g('minute')} ${g('dayPeriod')}`
}

// Each round has a theme. Displayed everywhere a round is named.
export const ROUND_NAMES: Record<InterviewRound, string> = { 1: 'Motivation', 2: 'Coding' }
/** "Round 1: Motivation". Pass short=true for just "Motivation". */
export function roundLabel(round: InterviewRound, short = false): string {
  const name = ROUND_NAMES[round] ?? ''
  return short ? name : `Round ${round}: ${name}`
}

export type SlotStatus = 'open' | 'booked' | 'blocked'
export type InterviewStatus = 'booked' | 'confirmed' | 'completed' | 'no_show' | 'cancelled'

export type InterviewSlot = {
  id: string
  interviewerEmail: string
  startsAt: string // ISO
  endsAt: string // ISO
  status: SlotStatus
}

export type Interview = {
  id: string
  candidateEmail: string
  round: InterviewRound
  slotId: string | null
  interviewerEmail: string
  scheduledAt: string // ISO
  status: InterviewStatus
  meetLink: string | null
  recommendation?: 'advance' | 'borderline' | 'no' | null
}

export const normEmail = (v: string | null | undefined) => (v ?? '').toString().trim().toLowerCase()

// Two ISO intervals overlap (touching endpoints are NOT an overlap).
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd)
}

// Validate a slot an interviewer wants to publish (against their existing slots).
export function validateNewSlot(
  slot: { startsAt: string; endsAt: string },
  existing: { startsAt: string; endsAt: string }[],
  now: Date,
): { ok: true } | { ok: false; error: string } {
  const s = new Date(slot.startsAt)
  const e = new Date(slot.endsAt)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return { ok: false, error: 'Invalid slot time.' }
  if (e <= s) return { ok: false, error: 'End must be after start.' }
  if (s <= now) return { ok: false, error: 'Slots must be in the future.' }
  if (existing.some((x) => overlaps(slot.startsAt, slot.endsAt, x.startsAt, x.endsAt)))
    return { ok: false, error: 'This overlaps a slot you already have.' }
  return { ok: true }
}

// Which round can this candidate book next, given their interviews? Sequential:
// round 1 first; round 2 only once round 1 is completed. Returns null if both done
// or the current round is still pending (booked/confirmed, not yet completed).
export function nextBookableRound(interviews: Pick<Interview, 'round' | 'status'>[]): InterviewRound | null {
  const active = interviews.filter((i) => i.status !== 'cancelled')
  const r1 = active.find((i) => i.round === 1)
  const r2 = active.find((i) => i.round === 2)
  if (!r1) return 1
  if (r1.status !== 'completed') return null // must finish round 1 first
  if (!r2) return 2
  return null // both booked/done
}

// A slot is bookable if open and starts in the future.
export function isSlotBookable(slot: Pick<InterviewSlot, 'status' | 'startsAt'>, now: Date): boolean {
  return slot.status === 'open' && new Date(slot.startsAt) > now
}

export type InterviewMetrics = {
  slotsOpen: number
  slotsBooked: number
  slotsBlocked: number
  scheduled: number // active bookings not yet completed (booked + confirmed)
  completed: number
  noShow: number
  cancelled: number
  // completed / (completed + no_show) — of interviews that were due, how many happened.
  showRatePct: number | null
}

export function computeInterviewMetrics(
  slots: Pick<InterviewSlot, 'status'>[],
  interviews: Pick<Interview, 'status'>[],
): InterviewMetrics {
  const s = { open: 0, booked: 0, blocked: 0 }
  for (const sl of slots) s[sl.status]++
  const i = { booked: 0, confirmed: 0, completed: 0, no_show: 0, cancelled: 0 }
  for (const iv of interviews) i[iv.status]++
  const due = i.completed + i.no_show
  return {
    slotsOpen: s.open,
    slotsBooked: s.booked,
    slotsBlocked: s.blocked,
    scheduled: i.booked + i.confirmed,
    completed: i.completed,
    noShow: i.no_show,
    cancelled: i.cancelled,
    showRatePct: due > 0 ? Math.round((100 * i.completed) / due) : null,
  }
}
