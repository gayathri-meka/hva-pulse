import { describe, expect, it } from 'vitest'
import { computeCodingInterviewAnalytics, computeMotivationInterviewAnalytics } from '@/lib/interviewAnalytics'

const now = new Date('2026-08-05T10:00:00.000Z')

describe('computeMotivationInterviewAnalytics', () => {
  it('counts all upcoming valid Motivation slots, including booked and the exact boundary', () => {
    const result = computeMotivationInterviewAnalytics([
      { id: 'now', round: 1, startsAt: now.toISOString(), status: 'open' },
      { id: 'future-booked', round: 1, startsAt: '2026-08-05T11:00:00.000Z', status: 'booked' },
      { id: 'past', round: 1, startsAt: '2026-08-05T09:59:59.999Z', status: 'open' },
      { id: 'blocked', round: 1, startsAt: '2026-08-06T10:00:00.000Z', status: 'blocked' },
      { id: 'coding', round: 2, startsAt: '2026-08-06T10:00:00.000Z', status: 'open' },
    ], [], now)

    expect(result.totalAvailableSlots).toBe(2)
  })

  it('counts unique candidates with confirmed upcoming bookings on valid slots', () => {
    const slots = [
      { id: 'valid', round: 1 as const, startsAt: now.toISOString(), status: 'booked' as const },
      { id: 'blocked', round: 1 as const, startsAt: '2026-08-06T10:00:00.000Z', status: 'blocked' as const },
      { id: 'past', round: 1 as const, startsAt: '2026-08-05T09:00:00.000Z', status: 'booked' as const },
    ]
    const base = { round: 1, recommendation: null, assessedAt: null }
    const result = computeMotivationInterviewAnalytics(slots, [
      { ...base, candidateEmail: ' A@example.com ', slotId: 'valid', scheduledAt: now.toISOString(), status: 'confirmed' },
      { ...base, candidateEmail: 'a@example.com', slotId: 'valid', scheduledAt: '2026-08-06T10:00:00.000Z', status: 'confirmed' },
      { ...base, candidateEmail: 'cancelled@example.com', slotId: 'valid', scheduledAt: now.toISOString(), status: 'cancelled' },
      { ...base, candidateEmail: 'blocked@example.com', slotId: 'blocked', scheduledAt: '2026-08-06T10:00:00.000Z', status: 'confirmed' },
      { ...base, candidateEmail: 'past@example.com', slotId: 'past', scheduledAt: '2026-08-05T09:00:00.000Z', status: 'confirmed' },
      { ...base, candidateEmail: 'orphan@example.com', slotId: null, scheduledAt: '2026-08-06T10:00:00.000Z', status: 'confirmed' },
    ], now)

    expect(result.scheduledInterviews).toBe(1)
  })

  it('counts lifetime unique decisions and keeps each candidate in the latest category', () => {
    const base = { round: 1, slotId: null, scheduledAt: '2025-01-01T00:00:00.000Z', status: 'completed' as const }
    const result = computeMotivationInterviewAnalytics([], [
      { ...base, candidateEmail: 'advanced@example.com', recommendation: 'advance', assessedAt: '2025-01-01T00:00:00.000Z' },
      { ...base, candidateEmail: 'borderline@example.com', recommendation: 'borderline', assessedAt: '2025-01-01T00:00:00.000Z' },
      { ...base, candidateEmail: 'no@example.com', recommendation: 'no', assessedAt: '2025-01-01T00:00:00.000Z' },
      { ...base, candidateEmail: 'changed@example.com', recommendation: 'advance', assessedAt: '2025-01-01T00:00:00.000Z' },
      { ...base, candidateEmail: 'changed@example.com', recommendation: 'borderline', assessedAt: '2025-02-01T00:00:00.000Z' },
      { ...base, candidateEmail: 'blank@example.com', recommendation: null, assessedAt: null },
      { ...base, round: 2, candidateEmail: 'coding@example.com', recommendation: 'advance', assessedAt: '2025-01-01T00:00:00.000Z' },
    ], now)

    expect(result).toMatchObject({ advanced: 1, borderline: 2, doNotAdvance: 1 })
  })
})

describe('computeCodingInterviewAnalytics', () => {
  it('counts unique shortlisted, selected, and rejected candidates for life', () => {
    const result = computeCodingInterviewAnalytics([
      { candidateEmail: 'selected@example.com', final: 'selected' },
      { candidateEmail: 'rejected@example.com', final: 'rejected' },
      { candidateEmail: '', final: 'selected' },
    ], 7)

    expect(result).toEqual({ shortlisted: 7, selected: 1, rejected: 1 })
  })
})
