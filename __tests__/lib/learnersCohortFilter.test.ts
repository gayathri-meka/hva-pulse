import { describe, test, expect } from 'vitest'
import { learnersCohortFilter } from '@/lib/learnersCohortFilter'

describe('learnersCohortFilter', () => {
  test('no fy param (default "All Cohorts") → active programme, not a hardcoded year', () => {
    // Regression: the default used to hardcode cohort_fy='2025-26', which hid
    // carryover learners (e.g. a 2024-25 learner still active this year).
    expect(learnersCohortFilter(undefined)).toEqual({ column: 'is_current_cohort', value: true })
    expect(learnersCohortFilter(null)).toEqual({ column: 'is_current_cohort', value: true })
    expect(learnersCohortFilter('')).toEqual({ column: 'is_current_cohort', value: true })
  })

  test('explicit fy=all → active programme', () => {
    expect(learnersCohortFilter('all')).toEqual({ column: 'is_current_cohort', value: true })
  })

  test('a specific year filters by cohort_fy', () => {
    expect(learnersCohortFilter('2025-26')).toEqual({ column: 'cohort_fy', value: '2025-26' })
    expect(learnersCohortFilter('2024-25')).toEqual({ column: 'cohort_fy', value: '2024-25' })
  })
})
