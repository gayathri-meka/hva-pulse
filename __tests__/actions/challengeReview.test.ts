import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireStaff: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
// challenge/actions.ts imports the BigQuery helper at module load; stub it so the
// import doesn't try to build a real client.
vi.mock('@/lib/bigquery', () => ({ runBigQuery: vi.fn() }))

import { requireStaff } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import {
  setChallengeDecision,
  bulkConfirmChallengeDecisions,
  updateChallengeReviewConfig,
} from '@/app/(protected)/admissions/challenge/actions'
import type { CriterionResult } from '@/lib/challengeReview'

const staffUser = { id: 'staff-1', role: 'staff' as const, name: 'Staff', email: 'staff@test.com' }

// from().upsert(rows, opts) → resolves { error }.
function mockUpsertClient(result: { error: { message: string } | null }) {
  const upsert = vi.fn().mockResolvedValue(result)
  const client = { from: vi.fn().mockReturnValue({ upsert }) }
  vi.mocked(createClient).mockReturnValue(client as never)
  return { client, upsert }
}

const snapshot: CriterionResult[] = [
  { key: 'active_days', label: 'Active days', group: 'engagement', status: 'pass', value: '12 days', threshold: '> 10 days', placeholder: false },
]

const base = {
  email: 'A@X.com',
  cohortId: 214,
  courseId: 587,
  systemDecision: 'selected' as const,
  criteriaSnapshot: snapshot,
}

beforeEach(() => vi.clearAllMocks())

describe('setChallengeDecision', () => {
  test('rejects a non-staff caller (requireStaff redirects)', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(setChallengeDecision({ ...base, decision: 'selected' })).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects an empty email', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const res = await setChallengeDecision({ ...base, email: '  ', decision: 'selected' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('no email') })
  })

  test('requires a reason when overriding the system recommendation', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    // system said selected, team rejects → override without reason.
    const res = await setChallengeDecision({ ...base, decision: 'rejected' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('reason is required') })
  })

  test('persists a confirmation matching the system (normalised email, not an override)', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { upsert } = mockUpsertClient({ error: null })
    const res = await setChallengeDecision({ ...base, decision: 'selected' })
    expect(res).toEqual({ ok: true })
    const [row, opts] = upsert.mock.calls[0]
    expect(row).toMatchObject({
      email: 'a@x.com',
      cohort_id: 214,
      course_id: 587,
      final_decision: 'selected',
      overrode_system: false,
      system_decision_at_verify: 'selected',
      decided_by: 'staff-1',
      decided_by_name: 'Staff',
      reason: null,
    })
    expect(opts).toEqual({ onConflict: 'email,cohort_id,course_id' })
  })

  test('persists an override with its reason flagged', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { upsert } = mockUpsertClient({ error: null })
    const res = await setChallengeDecision({ ...base, decision: 'rejected', reason: 'plagiarism' })
    expect(res).toEqual({ ok: true })
    expect(upsert.mock.calls[0][0]).toMatchObject({
      final_decision: 'rejected',
      overrode_system: true,
      reason: 'plagiarism',
    })
  })

  test('surfaces a DB error', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    mockUpsertClient({ error: { message: 'boom' } })
    expect(await setChallengeDecision({ ...base, decision: 'selected' })).toEqual({ ok: false, error: 'boom' })
  })
})

describe('bulkConfirmChallengeDecisions', () => {
  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(
      bulkConfirmChallengeDecisions({ cohortId: 214, courseId: 587, items: [] }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })

  test('confirms each row to its own system verdict (mixed selection, skips blank emails)', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { upsert } = mockUpsertClient({ error: null })
    const res = await bulkConfirmChallengeDecisions({
      cohortId: 214,
      courseId: 587,
      items: [
        { email: 'a@x.com', systemDecision: 'selected', criteriaSnapshot: snapshot },
        { email: 'b@x.com', systemDecision: 'rejected', criteriaSnapshot: snapshot },
        { email: '  ',      systemDecision: 'selected', criteriaSnapshot: snapshot }, // blank → skipped
      ],
    })
    expect(res).toEqual({ ok: true, count: 2 })
    const rows = upsert.mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ email: 'a@x.com', final_decision: 'selected', overrode_system: false })
    expect(rows[1]).toMatchObject({ email: 'b@x.com', final_decision: 'rejected', overrode_system: false })
  })

  test('errors when there is nothing to confirm', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    mockUpsertClient({ error: null })
    const res = await bulkConfirmChallengeDecisions({
      cohortId: 214,
      courseId: 587,
      items: [{ email: '  ', systemDecision: 'rejected', criteriaSnapshot: snapshot }],
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('No candidates') })
  })
})

describe('updateChallengeReviewConfig', () => {
  const good = { minAttemptedQuestions: 100, minActiveDays: 10, minSpanDays: 14, maxCrammingPct: 30 }

  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(
      updateChallengeReviewConfig({ cohortId: 214, courseId: 587, thresholds: good }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects negative / non-integer bounds', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, minActiveDays: -1 },
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('whole numbers') })
  })

  test('rejects cramming over 100', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, maxCrammingPct: 120 },
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('cannot exceed 100') })
  })

  test('upserts the config row keyed by (cohort, course)', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { upsert } = mockUpsertClient({ error: null })
    const res = await updateChallengeReviewConfig({ cohortId: 214, courseId: 587, thresholds: good })
    expect(res).toEqual({ ok: true })
    const [row, opts] = upsert.mock.calls[0]
    expect(row).toMatchObject({
      cohort_id: 214,
      course_id: 587,
      min_attempted_questions: 100,
      min_active_days: 10,
      min_span_days: 14,
      max_cramming_pct: 30,
      updated_by: 'staff-1',
    })
    expect(opts).toEqual({ onConflict: 'cohort_id,course_id' })
  })
})
