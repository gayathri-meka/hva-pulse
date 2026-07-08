import { describe, it, expect } from 'vitest'
import {
  evaluateCandidate,
  isExcludedCollege,
  DEFAULT_THRESHOLDS,
  type CandidateSignals,
} from '@/lib/challengeReview'

describe('isExcludedCollege', () => {
  const list = ['BMS College of Engineering', 'RV College of Engineering']
  it('matches on normalisation and trailing text, case-insensitively', () => {
    expect(isExcludedCollege('bms college of engineering', list)).toBe(true)
    expect(isExcludedCollege('R.V. College of Engineering, Bengaluru', list)).toBe(true)
  })
  it('does not match unrelated colleges or blanks', () => {
    expect(isExcludedCollege('Government First Grade College', list)).toBe(false)
    expect(isExcludedCollege('', list)).toBe(false)
  })
  it('does not false-match a DIFFERENT college that shares boilerplate words', () => {
    // "RV College of Engineering" must not match "BMS College of Engineering"
    // just because they share "College of Engineering".
    expect(isExcludedCollege('RV College of Engineering', ['BMS College of Engineering'])).toBe(false)
    expect(isExcludedCollege('PES Institute of Technology', ['BMS Institute of Technology'])).toBe(false)
  })
  it('matches on word reordering / extra words (token overlap)', () => {
    expect(isExcludedCollege('College of Engineering, BMS', list)).toBe(true)
  })
  it('ignores trivially short excluded entries', () => {
    expect(isExcludedCollege('anything', ['a', 'bc'])).toBe(false)
  })
})

// A candidate that clears every implemented criterion.
const passing: CandidateSignals = {
  attemptedQuestions: 150,
  totalQuestions: 200, // 75% attempted (>= default 40%)
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
    const r = evaluateCandidate({ attemptedQuestions: 10, totalQuestions: 200, activeDays: 2, spanDays: 3, crammingPct: 80 })
    expect(r.systemDecision).toBe('rejected')
    expect(r.failReasons).toHaveLength(4)
  })

  // Boundary checks — operators are attempted>min, active>min, span>=min, cramming<max.
  it('gates on the % of questions attempted (>= threshold)', () => {
    // Default threshold is 40%. Use /100 so the % is exact.
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 39, totalQuestions: 100 }), 'attempted_questions').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 40, totalQuestions: 100 }), 'attempted_questions').status).toBe('pass')
    // Value shows the % and the raw fraction.
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 40, totalQuestions: 100 }), 'attempted_questions').value).toBe('40% (40/100)')
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

  it('marks only the unbuilt criteria (SES, key-Q) as placeholders', () => {
    const r = evaluateCandidate(passing)
    for (const key of ['ses', 'key_question_score']) {
      expect(get(r, key).placeholder).toBe(true)
    }
    // Wired gates are NOT placeholders even when this candidate has no data — they
    // just come back 'na' (not applicable / no answer), never the "unbuilt" badge.
    for (const key of ['college', 'per_capita_income', 'graduation_timeline', 'work_commitment']) {
      expect(get(r, key).placeholder).toBe(false)
    }
  })

  it('leaves every intake criterion na (and out of the decision) when no intake data is present', () => {
    const r = evaluateCandidate(passing)
    for (const key of ['ses', 'college', 'per_capita_income', 'graduation_timeline', 'work_commitment', 'key_question_score']) {
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
    expect(get(r, 'college').group).toBe('need')
    expect(get(r, 'graduation_timeline').group).toBe('work_availability')
    expect(get(r, 'work_commitment').group).toBe('work_availability')
    expect(get(r, 'attempted_questions').group).toBe('engagement')
  })

  // ── Eligibility / straight-elimination gates ──────────────────────────────
  it('eliminates a candidate whose college is on the excluded list', () => {
    const excludedColleges = ['BMS College of Engineering', 'Nitte Meenakshi Institute of Technology']
    const th = { ...DEFAULT_THRESHOLDS, excludedColleges }
    const col = (collegeName?: string) => get(evaluateCandidate({ ...passing, collegeName }, th), 'college')
    // Exact + tolerant (trailing city / casing) matches → fail.
    expect(col('BMS College of Engineering').status).toBe('fail')
    expect(col('nitte meenakshi institute of technology, bengaluru').status).toBe('fail')
    // A non-listed college passes.
    expect(col('Some Rural Degree College').status).toBe('pass')
    // No college answer, or no list configured → na (gate inactive).
    expect(col(undefined).status).toBe('na')
    expect(get(evaluateCandidate({ ...passing, collegeName: 'BMS College of Engineering' }), 'college').status).toBe('na')
    expect(evaluateCandidate({ ...passing, collegeName: 'BMS College of Engineering' }, th).systemDecision).toBe('rejected')
  })

  it('graduation gate: distance/online any year, regular must finish by 2028', () => {
    const grad = (s: Partial<CandidateSignals>) => get(evaluateCandidate({ ...passing, currentlyStudying: true, ...s }), 'graduation_timeline').status
    // Regular (full/part-time): <=2028 pass, >=2029 fail.
    expect(grad({ courseType: 'full_time', graduationYear: 2028 })).toBe('pass')
    expect(grad({ courseType: 'full_time', graduationYear: 2029 })).toBe('fail')
    expect(grad({ courseType: 'part_time', graduationYear: 2030 })).toBe('fail')
    // Distance / online: pass at any year (even after 2028).
    expect(grad({ courseType: 'distance', graduationYear: 2031 })).toBe('pass')
    expect(grad({ courseType: 'online', graduationYear: 2031 })).toBe('pass')
    // Not studying → available → pass.
    expect(get(evaluateCandidate({ ...passing, currentlyStudying: false }), 'graduation_timeline').status).toBe('pass')
    // Late finisher but course type unknown → manual review (can't apply the exception).
    expect(grad({ graduationYear: 2030 })).toBe('na')
    expect(grad({})).toBe('na') // no year
  })

  it('work gate: not-working pass; >6LPA reject even if willing; ≤6LPA + willing pass', () => {
    const work = (s: Partial<CandidateSignals>) => get(evaluateCandidate({ ...passing, ...s }), 'work_commitment').status
    expect(work({ working: false })).toBe('pass')
    // Earning above the 6 LPA bar → reject regardless of willingness.
    expect(work({ working: true, monthlySalaryInr: 60_000, willingToQuit: true })).toBe('fail') // 7.2 LPA
    // At/below the bar: willing → pass, not willing → fail.
    expect(work({ working: true, monthlySalaryInr: 40_000, willingToQuit: true })).toBe('pass') // 4.8 LPA
    expect(work({ working: true, monthlySalaryInr: 40_000, willingToQuit: false })).toBe('fail')
    // Working but willingness unknown (income ok) → manual review.
    expect(work({ working: true, monthlySalaryInr: 40_000 })).toBe('na')
  })

  it('flags sensitive eligibility fails as internal-only', () => {
    const r = evaluateCandidate({ ...passing, collegeName: 'X', ses: 'fail' }, { ...DEFAULT_THRESHOLDS, excludedColleges: ['X College'] })
    expect(get(r, 'college').internalOnly).toBe(true)
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
    const lenient = { minQuestionsAttemptedPct: 2, minActiveDays: 1, minSpanDays: 2, maxCrammingPct: 90, maxWorkIncomeAnnual: 600_000 }
    const weak: CandidateSignals = { attemptedQuestions: 6, totalQuestions: 200, activeDays: 2, spanDays: 2, crammingPct: 80 }
    expect(evaluateCandidate(weak, lenient).systemDecision).toBe('selected')
    expect(evaluateCandidate(weak, DEFAULT_THRESHOLDS).systemDecision).toBe('rejected')
  })

  it('renders human-readable value/threshold strings for display', () => {
    const r = evaluateCandidate(passing)
    expect(get(r, 'attempted_questions').threshold).toContain('40%')
    expect(get(r, 'span').value).toBe('14 days')
    expect(get(r, 'cramming').threshold).toContain('30%')
  })
})
