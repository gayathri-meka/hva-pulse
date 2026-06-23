import { describe, test, expect } from 'vitest'
import { uniqueHiredLearnerCount } from '@/lib/placementMetrics'

describe('uniqueHiredLearnerCount', () => {
  test('counts distinct learners among hired applications', () => {
    expect(
      uniqueHiredLearnerCount([
        { status: 'hired', user_id: 'a' },
        { status: 'hired', user_id: 'b' },
        { status: 'applied', user_id: 'c' },
        { status: 'rejected', user_id: 'd' },
      ]),
    ).toBe(2)
  })

  test('dedupes a learner with multiple hired application rows', () => {
    expect(
      uniqueHiredLearnerCount([
        { status: 'hired', user_id: 'a' },
        { status: 'hired', user_id: 'a' },
      ]),
    ).toBe(1)
  })

  test('ignores hired rows with no user_id', () => {
    expect(
      uniqueHiredLearnerCount([
        { status: 'hired', user_id: null },
        { status: 'hired', user_id: undefined },
        { status: 'hired', user_id: 'a' },
      ]),
    ).toBe(1)
  })

  test('empty / no hires → 0', () => {
    expect(uniqueHiredLearnerCount([])).toBe(0)
    expect(uniqueHiredLearnerCount([{ status: 'applied', user_id: 'a' }])).toBe(0)
  })
})
