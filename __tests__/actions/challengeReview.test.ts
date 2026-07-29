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
  releaseChallengeDecisions,
  clearChallengeDecisions,
  updateChallengeReviewConfig,
  updateChallengeReviewNote,
} from '@/app/(protected)/admissions/challenge/actions'
import type { CriterionResult } from '@/lib/challengeReview'

const staffUser = { id: 'staff-1', role: 'staff' as const, name: 'Staff', email: 'staff@test.com' }
const adminUser = { id: 'admin-1', role: 'admin' as const, name: 'Admin', email: 'admin@test.com' }

// from().upsert(rows, opts) → resolves { error }.
function mockUpsertClient(result: { error: { message: string } | null }) {
  const upsert = vi.fn().mockResolvedValue(result)
  const client = { from: vi.fn().mockReturnValue({ upsert }) }
  vi.mocked(createClient).mockReturnValue(client as never)
  return { client, upsert }
}

// from().update().eq().eq().in().not().select() → resolves { data, error }.
function mockUpdateChain(result: { data?: unknown[]; error: { message: string } | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {}
  q.update = vi.fn(() => q)
  q.eq = vi.fn(() => q)
  q.in = vi.fn(() => q)
  q.not = vi.fn(() => q)
  q.select = vi.fn(() => Promise.resolve(result))
  const client = { from: vi.fn(() => q) }
  vi.mocked(createClient).mockReturnValue(client as never)
  return { client, q }
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
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Nothing to confirm') })
  })

  test('skips review-flagged candidates (not a confirmable verdict)', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { upsert } = mockUpsertClient({ error: null })
    await bulkConfirmChallengeDecisions({
      cohortId: 214,
      courseId: 587,
      items: [
        { email: 'a@x.com', systemDecision: 'selected', criteriaSnapshot: snapshot },
        { email: 'b@x.com', systemDecision: 'review', criteriaSnapshot: snapshot },
        { email: 'c@x.com', systemDecision: 'rejected', criteriaSnapshot: snapshot },
      ],
    })
    const rows = upsert.mock.calls[0][0] as { email: string; final_decision: string }[]
    expect(rows.map((r) => r.email)).toEqual(['a@x.com', 'c@x.com']) // review skipped
    expect(rows.every((r) => r.final_decision !== 'review')).toBe(true)
  })
})

describe('updateChallengeReviewConfig', () => {
  const good = { minQuestionsAttemptedPct: 40, minActiveDays: 10, minSpanDays: 14, maxCrammingPct: 30, maxGapDays: 4, maxWorkIncomeAnnual: 600_000 }

  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(
      updateChallengeReviewConfig({ cohortId: 214, courseId: 587, thresholds: good }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects a staff user because rule editing is admin-only', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    expect(await updateChallengeReviewConfig({ cohortId: 214, courseId: 587, thresholds: good }))
      .toEqual({ ok: false, error: expect.stringContaining('Only admins') })
  })

  test('rejects negative / non-integer bounds', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, minActiveDays: -1 },
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('whole numbers') })
  })

  test('rejects cramming over 100', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, maxCrammingPct: 120 },
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('cannot exceed 100') })
  })

  test('upserts the config row keyed by (cohort, course); per-capita null when unset', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const { upsert } = mockUpsertClient({ error: null })
    const res = await updateChallengeReviewConfig({ cohortId: 214, courseId: 587, thresholds: good })
    expect(res).toEqual({ ok: true })
    const [row, opts] = upsert.mock.calls[0]
    expect(row).toMatchObject({
      cohort_id: 214,
      course_id: 587,
      min_questions_attempted_pct: 40,
      min_active_days: 10,
      min_span_days: 14,
      max_cramming_pct: 30,
      max_work_income_annual: 600_000,
      max_per_capita_income_annual: null,
      updated_by: 'admin-1',
    })
    expect(opts).toEqual({ onConflict: 'cohort_id,course_id' })
  })

  test('writes the per-capita threshold when provided', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const { upsert } = mockUpsertClient({ error: null })
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, maxPerCapitaIncomeAnnual: 80_000 },
    })
    expect(res).toEqual({ ok: true })
    expect(upsert.mock.calls[0][0]).toMatchObject({ max_per_capita_income_annual: 80_000 })
  })

  test('rejects a negative per-capita threshold', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, maxPerCapitaIncomeAnnual: -5 },
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Per-capita') })
  })

  test('writes the excluded colleges, trimmed + deduped', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const { upsert } = mockUpsertClient({ error: null })
    await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, excludedColleges: ['  BMS College ', 'bms college', '', 'RV College'] },
    })
    expect(upsert.mock.calls[0][0].excluded_colleges).toEqual(['BMS College', 'RV College'])
  })

  test('writes SES weights + cutoff, and rejects a negative cutoff', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const { upsert } = mockUpsertClient({ error: null })
    await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, sesWeights: { social_category: 6 }, sesCutoff: 40 },
    })
    expect(upsert.mock.calls[0][0]).toMatchObject({ ses_weights: { social_category: 6 }, ses_cutoff: 40 })

    const bad = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: { ...good, sesCutoff: -1 },
    })
    expect(bad).toEqual({ ok: false, error: expect.stringContaining('SES cutoff') })
  })

  test('persists edited SES question and score-option text', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const { upsert } = mockUpsertClient({ error: null })
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: {
        ...good,
        sesQuestions: [{
          key: 'ses_custom_income',
          label: '  Per-capita income  ',
          answerSource: 'per_capita_income',
          optionLabels: {
            '0': '  Above ₹2L  ', '1': '  ₹1.5L–₹2L  ', '2': '  ₹1L–₹1,49,999  ',
            '3': '  ₹50,001–₹99,999  ', '4': '  Up to ₹50k  ',
          },
        }],
      },
    })
    expect(res).toEqual({ ok: true })
    expect(upsert.mock.calls[0][0].ses_questions).toEqual([{
      key: 'ses_custom_income',
      label: 'Per-capita income',
      answerSource: 'per_capita_income',
      optionLabels: {
        '0': 'Above ₹2L', '1': '₹1.5L–₹2L', '2': '₹1L–₹1,49,999',
        '3': '₹50,001–₹99,999', '4': 'Up to ₹50k',
      },
    }])
  })

  test.each([
    ['gaps', { '0': 'Above ₹2L', '1': '₹1.5L–₹1.9L', '2': '₹1L–₹1,49,999', '3': '₹50,001–₹99,999', '4': 'Up to ₹50k' }],
    ['overlaps', { '0': 'Above ₹2L', '1': '₹1.5L–₹2L', '2': '₹1L–₹1.5L', '3': '₹50k–₹1L', '4': 'Up to ₹50k' }],
    ['five identical open-ended bands', { '0': 'Above ₹2L', '1': 'Above ₹2L', '2': 'Above ₹2L', '3': 'Above ₹2L', '4': 'Above ₹2L' }],
    ['reordered bands', { '0': 'Up to ₹50k', '1': '₹50,001–₹99,999', '2': '₹1L–₹1,49,999', '3': '₹1.5L–₹2L', '4': 'Above ₹2L' }],
    ['no zero-income coverage', { '0': 'Above ₹2L', '1': '₹1.5L–₹2L', '2': '₹1L–₹1,49,999', '3': '₹50,001–₹99,999', '4': '₹1–₹50k' }],
  ])('rejects per-capita ranges with %s', async (_case, optionLabels) => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    const res = await updateChallengeReviewConfig({
      cohortId: 214,
      courseId: 587,
      thresholds: {
        ...good,
        sesQuestions: [{ key: 'ses_custom_income', label: 'Per-capita income', answerSource: 'per_capita_income', optionLabels }],
      },
    })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('no gaps or overlaps') })
  })
})

describe('releaseChallengeDecisions', () => {
  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(
      releaseChallengeDecisions({ cohortId: 214, courseId: 587, emails: ['a@x.com'], publish: true }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })

  test('errors when no candidates are given', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const res = await releaseChallengeDecisions({ cohortId: 214, courseId: 587, emails: ['  '], publish: true })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('No candidates') })
  })

  test('publishes only decided rows and reports the count', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { q } = mockUpdateChain({ data: [{ email: 'a@x.com' }], error: null })
    const res = await releaseChallengeDecisions({ cohortId: 214, courseId: 587, emails: ['A@X.com'], publish: true })
    expect(res).toEqual({ ok: true, count: 1 })
    // published_at set, and the "must be decided" filter is applied.
    expect(q.update.mock.calls[0][0].published_at).toEqual(expect.any(String))
    expect(q.not).toHaveBeenCalledWith('final_decision', 'is', null)
  })

  test('un-publishes when publish is false (published_at → null)', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { q } = mockUpdateChain({ data: [], error: null })
    await releaseChallengeDecisions({ cohortId: 214, courseId: 587, emails: ['a@x.com'], publish: false })
    expect(q.update.mock.calls[0][0].published_at).toBeNull()
  })
})

describe('clearChallengeDecisions', () => {
  // from().delete().eq().eq().in().select() → resolves { data, error }.
  function mockDeleteChain(result: { data?: unknown[]; error: { message: string } | null }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q: any = {}
    q.delete = vi.fn(() => q)
    q.eq = vi.fn(() => q)
    q.in = vi.fn(() => q)
    q.select = vi.fn(() => Promise.resolve(result))
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
    return { q }
  }

  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(
      clearChallengeDecisions({ cohortId: 214, courseId: 587, emails: ['a@x.com'] }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })

  test('errors when no candidates are given', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    expect(await clearChallengeDecisions({ cohortId: 214, courseId: 587, emails: [] })).toEqual({
      ok: false,
      error: expect.stringContaining('No candidates'),
    })
  })

  test('deletes the decision rows and reports the count', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { q } = mockDeleteChain({ data: [{ email: 'a@x.com' }, { email: 'b@x.com' }], error: null })
    const res = await clearChallengeDecisions({ cohortId: 214, courseId: 587, emails: ['A@X.com', 'b@x.com'] })
    expect(res).toEqual({ ok: true, count: 2 })
    expect(q.delete).toHaveBeenCalled()
  })
})

// from('challenge_review_notes') → either .upsert(row, opts) or
// .delete().eq().eq().eq(), each resolving { error }.
function mockNotesClient(opts: { upsertResult?: { error: { message: string } | null }; deleteResult?: { error: { message: string } | null } } = {}) {
  const upsert = vi.fn().mockResolvedValue(opts.upsertResult ?? { error: null })
  const eq3 = vi.fn().mockResolvedValue(opts.deleteResult ?? { error: null })
  const eq2 = vi.fn(() => ({ eq: eq3 }))
  const eq1 = vi.fn(() => ({ eq: eq2 }))
  const del = vi.fn(() => ({ eq: eq1 }))
  const client = { from: vi.fn(() => ({ upsert, delete: del })) }
  vi.mocked(createClient).mockReturnValue(client as never)
  return { upsert, del }
}

describe('updateChallengeReviewNote', () => {
  beforeEach(() => vi.clearAllMocks())

  test('redirects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(updateChallengeReviewNote({ cohortId: 214, courseId: 587, email: 'a@x.com', note: 'hi' })).rejects.toThrow('NEXT_REDIRECT')
  })

  test('requires a candidate email', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const res = await updateChallengeReviewNote({ cohortId: 214, courseId: 587, email: '   ', note: 'hi' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('email') })
  })

  test('rejects a note longer than 2000 chars', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const res = await updateChallengeReviewNote({ cohortId: 214, courseId: 587, email: 'a@x.com', note: 'x'.repeat(2001) })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('2,000') })
  })

  test('upserts a trimmed note with the editor id + conflict key', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { upsert, del } = mockNotesClient()
    const res = await updateChallengeReviewNote({ cohortId: 214, courseId: 587, email: 'A@X.com', note: '  keep this  ' })
    expect(res).toEqual({ ok: true })
    expect(del).not.toHaveBeenCalled()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@x.com', cohort_id: 214, course_id: 587, note: 'keep this', updated_by: 'staff-1' }),
      expect.objectContaining({ onConflict: 'email,cohort_id,course_id' }),
    )
  })

  test('deletes the note when cleared to empty', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const { upsert, del } = mockNotesClient()
    const res = await updateChallengeReviewNote({ cohortId: 214, courseId: 587, email: 'a@x.com', note: '   ' })
    expect(res).toEqual({ ok: true })
    expect(del).toHaveBeenCalled()
    expect(upsert).not.toHaveBeenCalled()
  })

  test('surfaces a db error', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    mockNotesClient({ upsertResult: { error: { message: 'boom' } } })
    const res = await updateChallengeReviewNote({ cohortId: 214, courseId: 587, email: 'a@x.com', note: 'hi' })
    expect(res).toEqual({ ok: false, error: 'boom' })
  })
})
