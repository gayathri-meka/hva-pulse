import { describe, it, expect } from 'vitest'
import {
  overlaps,
  validateNewSlot,
  nextBookableRound,
  isSlotBookable,
  computeInterviewMetrics,
} from '@/lib/interviews'

const iso = (d: string) => new Date(d).toISOString()
const NOW = new Date('2026-07-09T00:00:00Z')

describe('overlaps', () => {
  it('detects overlap and treats touching endpoints as non-overlap', () => {
    expect(overlaps(iso('2026-07-10T10:00Z'), iso('2026-07-10T11:00Z'), iso('2026-07-10T10:30Z'), iso('2026-07-10T11:30Z'))).toBe(true)
    expect(overlaps(iso('2026-07-10T10:00Z'), iso('2026-07-10T11:00Z'), iso('2026-07-10T11:00Z'), iso('2026-07-10T12:00Z'))).toBe(false)
  })
})

describe('validateNewSlot', () => {
  const future = { startsAt: iso('2026-07-10T10:00Z'), endsAt: iso('2026-07-10T11:00Z') }
  it('accepts a valid future slot with no overlap', () => {
    expect(validateNewSlot(future, [], NOW).ok).toBe(true)
  })
  it('rejects end before start', () => {
    expect(validateNewSlot({ startsAt: future.endsAt, endsAt: future.startsAt }, [], NOW).ok).toBe(false)
  })
  it('rejects slots in the past', () => {
    expect(validateNewSlot({ startsAt: iso('2026-07-08T10:00Z'), endsAt: iso('2026-07-08T11:00Z') }, [], NOW).ok).toBe(false)
  })
  it('rejects a slot overlapping an existing one', () => {
    const r = validateNewSlot(future, [{ startsAt: iso('2026-07-10T10:30Z'), endsAt: iso('2026-07-10T12:00Z') }], NOW)
    expect(r).toEqual({ ok: false, error: expect.stringContaining('overlaps') })
  })
})

describe('nextBookableRound (sequential)', () => {
  it('offers round 1 when nothing booked', () => {
    expect(nextBookableRound([])).toBe(1)
  })
  it('blocks round 2 while round 1 is not completed', () => {
    expect(nextBookableRound([{ round: 1, status: 'confirmed' }])).toBeNull()
    expect(nextBookableRound([{ round: 1, status: 'booked' }])).toBeNull()
  })
  it('offers round 2 once round 1 is completed', () => {
    expect(nextBookableRound([{ round: 1, status: 'completed' }])).toBe(2)
  })
  it('offers nothing when both rounds are active', () => {
    expect(nextBookableRound([{ round: 1, status: 'completed' }, { round: 2, status: 'confirmed' }])).toBeNull()
  })
  it('ignores cancelled interviews (re-offers the round)', () => {
    expect(nextBookableRound([{ round: 1, status: 'cancelled' }])).toBe(1)
  })
})

describe('isSlotBookable', () => {
  it('is true only for open future slots', () => {
    expect(isSlotBookable({ status: 'open', startsAt: iso('2026-07-10T10:00Z') }, NOW)).toBe(true)
    expect(isSlotBookable({ status: 'booked', startsAt: iso('2026-07-10T10:00Z') }, NOW)).toBe(false)
    expect(isSlotBookable({ status: 'open', startsAt: iso('2026-07-08T10:00Z') }, NOW)).toBe(false)
  })
})

describe('computeInterviewMetrics', () => {
  it('tallies slots + interviews and computes show rate', () => {
    const m = computeInterviewMetrics(
      [{ status: 'open' }, { status: 'open' }, { status: 'booked' }, { status: 'blocked' }],
      [{ status: 'confirmed' }, { status: 'completed' }, { status: 'completed' }, { status: 'no_show' }, { status: 'cancelled' }],
    )
    expect(m.slotsOpen).toBe(2)
    expect(m.slotsBooked).toBe(1)
    expect(m.slotsBlocked).toBe(1)
    expect(m.scheduled).toBe(1)
    expect(m.completed).toBe(2)
    expect(m.noShow).toBe(1)
    expect(m.cancelled).toBe(1)
    expect(m.showRatePct).toBe(67) // 2 / (2+1)
  })
  it('leaves show rate null when nothing is due', () => {
    expect(computeInterviewMetrics([], [{ status: 'confirmed' }]).showRatePct).toBeNull()
  })
})
