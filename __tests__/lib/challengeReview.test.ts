import { describe, it, expect } from 'vitest'
import {
  evaluateCandidate,
  DEFAULT_THRESHOLDS,
  type CandidateSignals,
} from '@/lib/challengeReview'

// A candidate that clears every implemented criterion.
const passing: CandidateSignals = {
  attemptedQuestions: 150,
  activeDays: 12,
  spanDays: 14,
  crammingPct: 20,
}

const get = (r: ReturnType<typeof evaluateCandidate>, key: string) =>
  r.criteria.find((c) => c.key === key)!

describe('evaluateCandidate', () => {
  it('selects a candidate who clears every implemented criterion', () => {
    const r = evaluateCandidate(passing)
    expect(r.systemDecision).toBe('selected')
    expect(r.failReasons).toEqual([])
    expect(get(r, 'attempted_questions').status).toBe('pass')
    expect(get(r, 'active_days').status).toBe('pass')
    expect(get(r, 'span').status).toBe('pass')
    expect(get(r, 'cramming').status).toBe('pass')
  })

  it('rejects and surfaces feedback when a single criterion fails', () => {
    const r = evaluateCandidate({ ...passing, activeDays: 5 })
    expect(r.systemDecision).toBe('rejected')
    expect(get(r, 'active_days').status).toBe('fail')
    expect(r.failReasons).toHaveLength(1)
    expect(r.failReasons[0]).toMatch(/active on 5 days/i)
  })

  it('collects feedback for every failed criterion', () => {
    const r = evaluateCandidate({ attemptedQuestions: 10, activeDays: 2, spanDays: 3, crammingPct: 80 })
    expect(r.systemDecision).toBe('rejected')
    expect(r.failReasons).toHaveLength(4)
  })

  // Boundary checks — operators are attempted>min, active>min, span>=min, cramming<max.
  it('treats attempted questions as strictly greater than the threshold', () => {
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 100 }), 'attempted_questions').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 101 }), 'attempted_questions').status).toBe('pass')
  })

  it('treats active days as strictly greater than the threshold', () => {
    expect(get(evaluateCandidate({ ...passing, activeDays: 10 }), 'active_days').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, activeDays: 11 }), 'active_days').status).toBe('pass')
  })

  it('treats span as greater-or-equal to the threshold', () => {
    expect(get(evaluateCandidate({ ...passing, spanDays: 13 }), 'span').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, spanDays: 14 }), 'span').status).toBe('pass')
  })

  it('treats cramming as strictly less than the threshold', () => {
    expect(get(evaluateCandidate({ ...passing, crammingPct: 30 }), 'cramming').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, crammingPct: 29 }), 'cramming').status).toBe('pass')
  })

  it('marks only the unbuilt criteria (SES, college tier, key-Q) as placeholders', () => {
    const r = evaluateCandidate(passing)
    for (const key of ['ses', 'college_tier', 'key_question_score']) {
      expect(get(r, key).placeholder).toBe(true)
    }
    // Wired gates are NOT placeholders even when this candidate has no data — they
    // just come back 'na' (not applicable / no answer), never the "unbuilt" badge.
    for (const key of ['per_capita_income', 'graduation_timeline', 'work_commitment']) {
      expect(get(r, key).placeholder).toBe(false)
    }
  })

  it('leaves every intake criterion na (and out of the decision) when no intake data is present', () => {
    const r = evaluateCandidate(passing)
    for (const key of ['ses', 'college_tier', 'per_capita_income', 'graduation_timeline', 'work_commitment', 'key_question_score']) {
      expect(get(r, key).status).toBe('na')
    }
    expect(r.systemDecision).toBe('selected')
  })

  it('gates per-capita income (annual income ÷ family size) against the configured threshold', () => {
    const th = { ...DEFAULT_THRESHOLDS, maxPerCapitaIncomeAnnual: 100_000 }
    const pc = (familyAnnualIncomeInr: number | undefined, familySize: number | undefined) =>
      get(evaluateCandidate({ ...passing, familyAnnualIncomeInr, familySize }, th), 'per_capita_income')
    expect(pc(300_000, 5).status).toBe('pass') // 60k < 100k → need established
    expect(pc(600_000, 4).status).toBe('fail') // 150k ≥ 100k
    expect(pc(400_000, 4).status).toBe('fail') // 100k is not < 100k (strict)
    expect(pc(undefined, 4).status).toBe('na') // missing income
    expect(pc(500_000, undefined).status).toBe('na') // missing size
    expect(get(evaluateCandidate({ ...passing, familyAnnualIncomeInr: 600_000, familySize: 4 }, th), 'per_capita_income').group).toBe('need')
    expect(get(evaluateCandidate({ ...passing, familyAnnualIncomeInr: 600_000, familySize: 4 }, th), 'per_capita_income').internalOnly).toBe(true)
  })

  it('leaves per-capita na until a threshold is configured', () => {
    // DEFAULT_THRESHOLDS has no maxPerCapitaIncomeAnnual set.
    const r = get(evaluateCandidate({ ...passing, familyAnnualIncomeInr: 100_000, familySize: 4 }), 'per_capita_income')
    expect(r.status).toBe('na')
  })

  it('groups criteria into need, work & availability, and engagement', () => {
    const r = evaluateCandidate(passing)
    expect(get(r, 'ses').group).toBe('need')
    expect(get(r, 'college_tier').group).toBe('need')
    expect(get(r, 'graduation_timeline').group).toBe('work_availability')
    expect(get(r, 'work_commitment').group).toBe('work_availability')
    expect(get(r, 'attempted_questions').group).toBe('engagement')
  })

  // ── Eligibility / straight-elimination gates ──────────────────────────────
  it('eliminates Tier 1 / Tier 2 colleges and passes Tier 3', () => {
    expect(get(evaluateCandidate({ ...passing, collegeTier: 1 }), 'college_tier').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, collegeTier: 2 }), 'college_tier').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, collegeTier: 3 }), 'college_tier').status).toBe('pass')
    expect(evaluateCandidate({ ...passing, collegeTier: 1 }).systemDecision).toBe('rejected')
  })

  it('rejects students finishing 2028+, passes 2027-and-earlier and non-students', () => {
    expect(get(evaluateCandidate({ ...passing, currentlyStudying: true, graduationYear: 2028 }), 'graduation_timeline').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, currentlyStudying: true, graduationYear: 2029 }), 'graduation_timeline').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, currentlyStudying: true, graduationYear: 2027 }), 'graduation_timeline').status).toBe('pass')
    // Not currently studying → available now → pass, regardless of any year.
    expect(get(evaluateCandidate({ ...passing, currentlyStudying: false }), 'graduation_timeline').status).toBe('pass')
    // A student whose completion year we couldn't read → manual review.
    expect(get(evaluateCandidate({ ...passing, currentlyStudying: true }), 'graduation_timeline').status).toBe('na')
    expect(evaluateCandidate({ ...passing, currentlyStudying: true, graduationYear: 2028 }).systemDecision).toBe('rejected')
  })

  it('eliminates a working candidate unwilling to leave, passes the rest', () => {
    expect(get(evaluateCandidate({ ...passing, working: true, willingToQuit: false }), 'work_commitment').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, working: true, willingToQuit: true }), 'work_commitment').status).toBe('pass')
    expect(get(evaluateCandidate({ ...passing, working: false }), 'work_commitment').status).toBe('pass')
    // working but willingness unknown → manual review.
    expect(get(evaluateCandidate({ ...passing, working: true }), 'work_commitment').status).toBe('na')
  })

  it('flags sensitive eligibility fails as internal-only', () => {
    const r = evaluateCandidate({ ...passing, collegeTier: 1, ses: 'fail' })
    expect(get(r, 'college_tier').internalOnly).toBe(true)
    expect(get(r, 'ses').internalOnly).toBe(true)
    // engagement + neutral gates are candidate-visible.
    expect(get(r, 'work_commitment').internalOnly).toBeUndefined()
    expect(get(r, 'active_days').internalOnly).toBeUndefined()
  })

  it('lets an SES fail gate the decision when a signal is supplied', () => {
    const r = evaluateCandidate({ ...passing, ses: 'fail' })
    expect(get(r, 'ses').status).toBe('fail') // a fail status gates regardless of the placeholder flag
    expect(r.systemDecision).toBe('rejected')
  })

  it('honours custom thresholds', () => {
    const lenient = { minAttemptedQuestions: 5, minActiveDays: 1, minSpanDays: 2, maxCrammingPct: 90 }
    const weak: CandidateSignals = { attemptedQuestions: 6, activeDays: 2, spanDays: 2, crammingPct: 80 }
    expect(evaluateCandidate(weak, lenient).systemDecision).toBe('selected')
    expect(evaluateCandidate(weak, DEFAULT_THRESHOLDS).systemDecision).toBe('rejected')
  })

  it('renders human-readable value/threshold strings for display', () => {
    const r = evaluateCandidate(passing)
    expect(get(r, 'attempted_questions').threshold).toBe('> 100')
    expect(get(r, 'span').value).toBe('14 days')
    expect(get(r, 'cramming').threshold).toBe('< 30%')
  })
})
