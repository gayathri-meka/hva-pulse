import { describe, test, expect } from 'vitest'
import { computeSnapshot } from '@/lib/snapshot'

describe('computeSnapshot', () => {
  test('returns all-zero stats for empty data', () => {
    const result = computeSnapshot(0, [], [])
    expect(result.total).toBe(0)
    expect(result.applied).toBe(0)
    expect(result.notInterested).toBe(0)
    expect(result.ignored).toBe(0)
    expect(result.applicationRate).toBe(0)
  })

  test('counts applied, notInterested, and ignored correctly', () => {
    const result = computeSnapshot(
      10,
      [{ status: 'applied' }, { status: 'shortlisted' }, { status: 'hired' }],
      [{ preference: 'not_interested' }, { preference: 'not_interested' }],
    )
    expect(result.total).toBe(10)
    expect(result.applied).toBe(3)
    expect(result.notInterested).toBe(2)
    expect(result.ignored).toBe(5)
  })

  test('computes applicationRate as a rounded percentage', () => {
    // 3 applied out of 7 = 42.857... → rounds to 43
    const result = computeSnapshot(7, Array(3).fill({ status: 'applied' }), [])
    expect(result.applicationRate).toBe(43)
  })

  test('applicationRate is 0 when there are no roles', () => {
    const result = computeSnapshot(0, [], [])
    expect(result.applicationRate).toBe(0)
  })

  test('breaks down application statuses correctly', () => {
    const applications = [
      { status: 'applied' },
      { status: 'applied' },
      { status: 'shortlisted' },
      { status: 'not_shortlisted' },
      { status: 'rejected' },
      { status: 'hired' },
    ]
    const result = computeSnapshot(10, applications, [])
    expect(result.pending).toBe(2)
    expect(result.shortlisted).toBe(1)
    expect(result.notShortlisted).toBe(1)
    expect(result.rejected).toBe(1)
    expect(result.hired).toBe(1)
  })

  test('aggregates not-interested reasons across all preferences', () => {
    const preferences = [
      { preference: 'not_interested', reasons: ['Location Mismatch', 'Salary too low'] },
      { preference: 'not_interested', reasons: ['Location Mismatch'] },
      { preference: 'not_interested', reasons: [] },
    ]
    const result = computeSnapshot(5, [], preferences)
    expect(result.reasonCounts['Location Mismatch']).toBe(2)
    expect(result.reasonCounts['Salary too low']).toBe(1)
  })

  test('ignores preferences that are not not_interested', () => {
    const preferences = [
      { preference: 'interested' },
      { preference: 'not_interested', reasons: ['Too far'] },
    ]
    const result = computeSnapshot(5, [], preferences)
    expect(result.notInterested).toBe(1)
    expect(result.reasonCounts['Too far']).toBe(1)
  })

  test('handles preferences with null reasons without throwing', () => {
    const preferences = [{ preference: 'not_interested', reasons: null }]
    const result = computeSnapshot(3, [], preferences)
    expect(result.notInterested).toBe(1)
    expect(result.reasonCounts).toEqual({})
  })
})
