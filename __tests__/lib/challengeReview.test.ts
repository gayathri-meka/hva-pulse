import { describe, it, expect } from 'vitest'
import {
  evaluateCandidate,
  isExcludedCollege,
  isChallengeFinished,
  candidateRejectionReasons,
  fillRejectionMessage,
  REJECTION_TEMPLATES,
  GENERIC_REJECTION_MESSAGE,
  DEFAULT_THRESHOLDS,
  type CandidateSignals,
  type CriterionResult,
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
  totalQuestions: 200,
  attemptedItems: 150,
  totalItems: 200, // 75% of items attempted (>= default 40%)
  activeDays: 12,
  spanDays: 14,
  crammingPct: 20,
  // Determinable eligibility so nothing is 'undetermined' → not a 'review' by default.
  currentlyStudying: false, // graduation gate passes (available now)
  working: false, // work gate passes (not working)
}

const get = (r: ReturnType<typeof evaluateCandidate>, key: string) =>
  r.criteria.find((c) => c.key === key)!

describe('isChallengeFinished (evaluable rule)', () => {
  const DAY = 86_400_000
  const now = new Date('2026-07-20T12:00:00Z').getTime()
  const base = { attemptedQuestions: 0, totalQuestions: 263, nowMs: now }
  it('completed — attempted every question → evaluable', () => {
    const recent = new Date(now - DAY).toISOString()
    expect(isChallengeFinished({ ...base, lastActive: recent, attemptedQuestions: 263 })).toBe(true)
    // recently active + not all attempted → still pending
    expect(isChallengeFinished({ ...base, lastActive: recent, attemptedQuestions: 262 })).toBe(false)
  })
  it('inactive for 7+ days → evaluable; within 7 days → pending', () => {
    expect(isChallengeFinished({ ...base, lastActive: new Date(now - 6 * DAY).toISOString() })).toBe(false)
    expect(isChallengeFinished({ ...base, lastActive: new Date(now - 7 * DAY).toISOString() })).toBe(true)
  })
  it('never-started (no activity) stays pending until the cohort end date passes', () => {
    expect(isChallengeFinished({ ...base, lastActive: null })).toBe(false)
    expect(isChallengeFinished({ ...base, lastActive: null, challengeEndDate: '2026-07-25' })).toBe(false)
    expect(isChallengeFinished({ ...base, lastActive: null, challengeEndDate: '2026-07-19' })).toBe(true)
  })
})

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
    // Cramming is independent of the active/span/gap cluster, so it isolates cleanly.
    const r = evaluateCandidate({ ...passing, crammingPct: 40 })
    expect(r.systemDecision).toBe('rejected')
    expect(get(r, 'cramming').status).toBe('fail')
    expect(r.failReasons).toHaveLength(1)
    expect(r.failReasons[0]).toMatch(/crammed/i)
  })

  it('collects feedback for every failed criterion', () => {
    const r = evaluateCandidate({ attemptedQuestions: 10, totalQuestions: 200, attemptedItems: 10, totalItems: 200, activeDays: 2, spanDays: 3, crammingPct: 80 })
    expect(r.systemDecision).toBe('rejected')
    expect(r.failReasons).toHaveLength(4)
  })

  // Boundary checks — operators are attempted>=min, active>min, span>=min, cramming<max.
  it('gates on the % of questions attempted (>= threshold)', () => {
    // Default threshold is 40%. Use /100 so the % is exact.
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 39, totalQuestions: 100 }), 'attempted_questions').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 40, totalQuestions: 100 }), 'attempted_questions').status).toBe('pass')
    // Value shows the % and the raw fraction (of questions).
    expect(get(evaluateCandidate({ ...passing, attemptedQuestions: 40, totalQuestions: 100 }), 'attempted_questions').value).toBe('40% (40/100)')

    const almostComplete = evaluateCandidate(
      { ...passing, attemptedQuestions: 262, totalQuestions: 263 },
      { ...DEFAULT_THRESHOLDS, minQuestionsAttemptedPct: 100 },
    )
    expect(get(almostComplete, 'attempted_questions')).toMatchObject({
      status: 'fail',
      value: '99.62% (262/263)',
      sortValue: 99.62,
    })
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

  it('consistency gates on gap days (span − active) < maxGapDays', () => {
    // gap 2 (14 − 12) < 4 → pass; gap 5 (20 − 15) ≥ 4 → fail (other gates still pass).
    expect(get(evaluateCandidate({ ...passing, spanDays: 14, activeDays: 12 }), 'consistency').status).toBe('pass')
    const gappy = evaluateCandidate({ ...passing, spanDays: 20, activeDays: 15 })
    expect(get(gappy, 'consistency').value).toBe('5 gap days')
    expect(get(gappy, 'consistency').status).toBe('fail')
    expect(gappy.systemDecision).toBe('rejected')
  })

  it('a disabled rule is shown but does not gate the decision', () => {
    // Same gappy candidate, but with consistency turned off → no longer rejects.
    const r = evaluateCandidate({ ...passing, spanDays: 20, activeDays: 15 }, { ...DEFAULT_THRESHOLDS, disabledRules: ['consistency'] })
    expect(get(r, 'consistency').disabled).toBe(true)
    expect(get(r, 'consistency').status).toBe('fail') // still computed/shown
    expect(r.systemDecision).toBe('selected') // but not gating
  })

  it('has no unbuilt placeholders left; key-Q is informational', () => {
    const r = evaluateCandidate(passing)
    for (const key of ['ses', 'college', 'per_capita_income', 'graduation_timeline', 'work_commitment', 'key_question_score']) {
      expect(get(r, key).placeholder).toBe(false)
    }
    expect(get(r, 'key_question_score').informational).toBe(true)
  })

  it('is "in_progress" while unfinished — no rules run, even with hard fails', () => {
    // A candidate mid-challenge (span 5 < 14) would normally REJECT; while unfinished
    // the system must not evaluate → in_progress, no fail reasons.
    const r = evaluateCandidate({ ...passing, spanDays: 5, activeDays: 3, crammingPct: 90, challengeFinished: false })
    expect(r.systemDecision).toBe('in_progress')
    expect(r.failReasons).toEqual([])
    // Once finished, the same signals evaluate normally → rejected.
    expect(evaluateCandidate({ ...passing, spanDays: 5, activeDays: 3, crammingPct: 90, challengeFinished: true }).systemDecision).toBe('rejected')
  })

  it('never lets the informational Challenge-question score gate the decision', () => {
    // Even a 0% key-question score must not reject an otherwise-passing candidate.
    const r = evaluateCandidate({ ...passing, keyQuestionScorePct: 0 })
    expect(get(r, 'key_question_score').value).toBe('0% passed')
    expect(r.systemDecision).toBe('selected')
    expect(r.failReasons).toEqual([])
  })

  it('shows the average grader score (0–4) alongside the pass rate when present', () => {
    const r = evaluateCandidate({ ...passing, keyQuestionScorePct: 60, keyQuestionAvgScore: 3.2 })
    expect(get(r, 'key_question_score').value).toBe('avg 3.2/4 · 60% passed')
  })

  it('config-inactive na gates (unset thresholds) stay neutral → still selected', () => {
    // passing has determinable work/graduation; ses/college/per-capita are na because
    // their gates aren't configured (DEFAULT_THRESHOLDS) — those must NOT block.
    const r = evaluateCandidate(passing)
    for (const key of ['ses', 'college', 'per_capita_income']) {
      expect(get(r, key).status).toBe('na')
      expect(get(r, key).undetermined).toBeFalsy()
    }
    expect(r.systemDecision).toBe('selected')
  })

  it('undetermined candidate data (missing work/graduation) → needs review, not selected', () => {
    // No work/study signal → both na AND undetermined (no config gate involved).
    const r = evaluateCandidate({ attemptedQuestions: 150, totalQuestions: 200, attemptedItems: 150, totalItems: 200, activeDays: 12, spanDays: 14, crammingPct: 20 })
    expect(get(r, 'work_commitment').undetermined).toBe(true)
    expect(get(r, 'graduation_timeline').undetermined).toBe(true)
    expect(r.systemDecision).toBe('review')
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

  it('exposes numeric sortValue so columns sort by value (income least→highest), na undefined', () => {
    const r = evaluateCandidate({ ...passing, familyAnnualIncomeInr: 400_000, familySize: 4, activeDays: 12 })
    // Per-capita income sorts by the actual ₹/yr per person (100k here), not pass/fail.
    expect(get(r, 'per_capita_income').sortValue).toBe(100_000)
    expect(get(r, 'active_days').sortValue).toBe(12)
    expect(get(r, 'span').sortValue).toBe(passing.spanDays)
    // No income data → sortValue undefined (sorts to the end).
    expect(get(evaluateCandidate({ ...passing, familyAnnualIncomeInr: undefined }), 'per_capita_income').sortValue).toBeUndefined()
    // Non-numeric gates carry no sortValue.
    expect(get(r, 'college').sortValue).toBeUndefined()
  })

  it('SES criterion exposes its score as sortValue (so the column sorts by score)', () => {
    // social_category 'a' = SC = 3 × default weight 5 = 15.
    const r = evaluateCandidate({ ...passing, sesAnswers: { social_category_raw: 'a' } }, { ...DEFAULT_THRESHOLDS, sesCutoff: 10 })
    expect(get(r, 'ses').value).toContain('15')
    expect(get(r, 'ses').sortValue).toBe(15)
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
    const r = evaluateCandidate({ ...passing, collegeName: 'X' }, { ...DEFAULT_THRESHOLDS, excludedColleges: ['X College'] })
    expect(get(r, 'college').internalOnly).toBe(true)
    expect(get(r, 'ses').internalOnly).toBe(true)
    // engagement + neutral gates are candidate-visible.
    expect(get(r, 'work_commitment').internalOnly).toBeUndefined()
    expect(get(r, 'active_days').internalOnly).toBeUndefined()
  })

  it('SES gates on the weighted score vs the cutoff', () => {
    // social_category a=SC=3 × weight 5 = 15. Cutoff 20 → fail; cutoff 10 → pass.
    const answers = { social_category_raw: 'a' }
    expect(get(evaluateCandidate({ ...passing, sesAnswers: answers }, { ...DEFAULT_THRESHOLDS, sesCutoff: 20 }), 'ses').status).toBe('fail')
    expect(get(evaluateCandidate({ ...passing, sesAnswers: answers }, { ...DEFAULT_THRESHOLDS, sesCutoff: 10 }), 'ses').status).toBe('pass')
    // No cutoff configured, or no answers → na (never gates).
    expect(get(evaluateCandidate({ ...passing, sesAnswers: answers }), 'ses').status).toBe('na')
    expect(get(evaluateCandidate({ ...passing }, { ...DEFAULT_THRESHOLDS, sesCutoff: 10 }), 'ses').status).toBe('na')
    expect(evaluateCandidate({ ...passing, sesAnswers: answers }, { ...DEFAULT_THRESHOLDS, sesCutoff: 20 }).systemDecision).toBe('rejected')
  })

  it('adds a configured per-capita rule to the SES score and breakdown', () => {
    const sesQuestions = [{
      key: 'ses_custom_income', label: 'Per-capita income', answerSource: 'per_capita_income' as const,
      optionLabels: { '0': 'Above ₹2L', '1': '₹1.5L–₹2L', '2': '₹1L–₹1.5L', '3': '₹50k–₹1L', '4': 'Up to ₹50k' },
    }]
    const result = evaluateCandidate(
      { ...passing, sesAnswers: {}, familyAnnualIncomeInr: 300_000, familySize: 4 },
      { ...DEFAULT_THRESHOLDS, sesQuestions, sesWeights: { ses_custom_income: 2 }, sesCutoff: 6 },
    )
    const ses = get(result, 'ses')
    expect(ses.status).toBe('pass')
    expect(ses.value).toBe('6 / 8')
    expect(ses.sesBreakdown).toEqual([
      expect.objectContaining({ key: 'ses_custom_income', optionScore: 3, weight: 2, contribution: 6 }),
    ])
  })

  it('honours custom thresholds', () => {
    const lenient = { minQuestionsAttemptedPct: 2, minActiveDays: 1, minSpanDays: 2, maxCrammingPct: 90, maxGapDays: 4, maxWorkIncomeAnnual: 600_000 }
    const weak: CandidateSignals = { attemptedQuestions: 6, totalQuestions: 200, attemptedItems: 6, totalItems: 200, activeDays: 2, spanDays: 2, crammingPct: 80, currentlyStudying: false, working: false }
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

describe('fillRejectionMessage', () => {
  const signals = { attemptedQuestions: 0, totalQuestions: 0, attemptedItems: 0, totalItems: 0, activeDays: 3, spanDays: 11, crammingPct: 0 } as CandidateSignals
  it('substitutes {Name} (first name) and {X} per reason', () => {
    expect(fillRejectionMessage(REJECTION_TEMPLATES.active_days, 'Asha Kumar', 'active_days', signals)).toContain('Hi Asha,')
    expect(fillRejectionMessage(REJECTION_TEMPLATES.active_days, 'Asha', 'active_days', signals)).toContain('activity on 3 out of the 14 days')
    expect(fillRejectionMessage(REJECTION_TEMPLATES.span, 'Asha', 'span', signals)).toContain('took 11 days')
    // gap days = span − active = 11 − 3 = 8
    expect(fillRejectionMessage(REJECTION_TEMPLATES.consistency, 'Asha', 'consistency', signals)).toContain('more than 8 days')
  })
  it('falls back to "there" when name is blank', () => {
    expect(fillRejectionMessage(REJECTION_TEMPLATES.ses, '', 'ses', signals)).toContain('Hi there,')
  })
})

describe('candidateRejectionReasons', () => {
  const crit = (key: string, status: 'pass' | 'fail' | 'na', extra: Partial<CriterionResult> = {}): CriterionResult =>
    ({ key, label: key, group: 'engagement', status, value: '', threshold: '', placeholder: false, ...extra })
  const signals = { attemptedQuestions: 0, totalQuestions: 0, attemptedItems: 0, totalItems: 0, activeDays: 2, spanDays: 10, crammingPct: 0 } as CandidateSignals

  it('returns one reason per failed criterion that has a template, ordered, + general last', () => {
    const criteria = [crit('active_days', 'fail'), crit('cramming', 'fail'), crit('span', 'pass')]
    const reasons = candidateRejectionReasons(criteria, { name: 'Asha', signals })
    // cramming has no template → excluded; span passed → excluded; general always last
    expect(reasons.map((r) => r.key)).toEqual(['active_days', 'general'])
    expect(reasons[0].message).toContain('Asha')
    expect(reasons[1].message).toBe(GENERIC_REJECTION_MESSAGE)
  })
  it('includes sensitive (internal-only) gates when they have a candidate-safe template', () => {
    const reasons = candidateRejectionReasons([crit('ses', 'fail', { internalOnly: true })], { name: 'A', signals })
    expect(reasons.map((r) => r.key)).toEqual(['ses', 'general'])
  })
  it('is just the general fallback when nothing templated failed', () => {
    const reasons = candidateRejectionReasons([crit('cramming', 'fail'), crit('active_days', 'pass')], { name: 'A', signals })
    expect(reasons.map((r) => r.key)).toEqual(['general'])
  })
})
