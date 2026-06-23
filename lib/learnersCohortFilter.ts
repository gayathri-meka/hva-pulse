// Decides how the /learners list is scoped by the `fy` (cohort financial year)
// URL param.
//
// A specific year filters by `cohort_fy`. The default — no `fy` param, which the
// FY dropdown shows as "All Cohorts", or an explicit `fy=all` — scopes to the
// active programme via `is_current_cohort = true`. This INCLUDES carryover
// learners whose `cohort_fy` is an earlier year but who are still active this
// year (e.g. a 2024-25 learner still in the programme). Previously the default
// hardcoded `cohort_fy = '2025-26'`, which silently dropped those carryovers.

export type CohortFilter =
  | { column: 'cohort_fy'; value: string }
  | { column: 'is_current_cohort'; value: true }

export function learnersCohortFilter(fy: string | undefined | null): CohortFilter {
  if (fy && fy !== 'all') return { column: 'cohort_fy', value: fy }
  return { column: 'is_current_cohort', value: true }
}
