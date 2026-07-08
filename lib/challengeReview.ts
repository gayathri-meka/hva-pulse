import { computeSes, sesMaxScore, type SesWeights, type SesBreakdownRow } from './ses'

// Challenge review rule engine — the challenge→interview selection gate.
//
// Pure + deterministic: given a candidate's signals + the (editable) thresholds,
// it produces a per-criterion pass/fail and an overall SYSTEM decision. The admin
// Review tab renders the criteria; the team verifies before anything reaches the
// candidate (see migrations/059_challenge_review.sql).
//
// Operators are fixed HERE (only the numeric bounds are editable, stored in
// challenge_review_config): attempted > min, active > min, span >= min, cramming < max.
//
// Placeholder criteria (SES, key-question score) are wired but not yet implemented,
// so they evaluate to 'na' and DO NOT affect the decision. Once implemented they
// become real pass/fail criteria and start gating automatically. SES is intended to
// be a hard need-gate; because the decision requires every non-'na' criterion to
// pass, an SES fail will reject regardless of performance the moment it goes live.

// Recording a Select/Reject is now internal-only — it does NOT reach the candidate
// until it's explicitly *released* to the portal (see releaseChallengeDecisions).
// So decision recording is enabled; the deliberate, guarded step is Release.
export const REVIEW_DECISIONS_ENABLED = true

export type ReviewThresholds = {
  minQuestionsAttemptedPct: number // % of all quiz questions attempted must be >= this
  minActiveDays: number         // active days must be > this
  minSpanDays: number           // span (first→last, inclusive) must be >= this
  maxCrammingPct: number        // cramming % must be < this
  // A working candidate earning MORE than this per year is rejected regardless of
  // willingness to quit (their own annual salary). Editable "6 LPA" bar.
  maxWorkIncomeAnnual: number
  // Per-capita family income (annual) must be BELOW this to establish need.
  // Undefined = not configured yet → the per-capita criterion stays 'na'.
  maxPerCapitaIncomeAnnual?: number
  // Colleges we won't take learners from. A candidate whose college matches one is
  // eliminated. Empty/undefined = the college gate is inactive (criterion stays 'na').
  excludedColleges?: string[]
  // SES: per-question weight overrides ({} = defaults) + the pass cutoff. Cutoff
  // undefined = not configured → the SES criterion stays 'na'.
  sesWeights?: SesWeights
  sesCutoff?: number
}

// Short label for a course type (for the criterion value display).
function courseTypeShort(c: CandidateSignals['courseType']): string {
  return c === 'full_time' ? 'FT' : c === 'part_time' ? 'PT' : c === 'distance' ? 'Distance' : c === 'online' ? 'Online' : ''
}

// ₹ per year → "LPA" figure, trimming a trailing ".0" (600000 → "6", 180000 → "1.8").
function lpa(annualInr: number): string {
  return String(Number((annualInr / 100_000).toFixed(1)))
}

// Normalise a college name for the spaceless key: lowercase, strip ALL
// non-alphanumerics, so "R.V. College", "R V College" and "rv college" collapse
// to the same key (handles punctuation + spacing + acronym dots).
function normCollege(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

// Word tokens (for order-insensitive overlap).
function collegeTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter++
  return inter / (a.size + b.size - inter)
}

// Fuzzy match a college name against the excluded list. NOT exact-string:
//   • normalised (punctuation/spacing/acronym-dot insensitive)
//   • substring either way — tolerates trailing city/branch text
//   • token-Jaccard ≥ 0.7 — tolerates word reordering / extra words
// Deliberately NOT character-similarity (Dice/Levenshtein): college names share
// boilerplate ("College of Engineering"), which makes different colleges score
// falsely high. Jaccard on whole tokens keeps different institutions apart.
export function isExcludedCollege(collegeName: string, excluded: string[]): boolean {
  const c = normCollege(collegeName)
  if (c.length < 4) return false
  const cTokens = collegeTokens(collegeName)
  return excluded.some((e) => {
    const n = normCollege(e)
    if (n.length < 4) return false
    if (c === n || c.includes(n) || n.includes(c)) return true
    return jaccard(cTokens, collegeTokens(e)) >= 0.7
  })
}

export const DEFAULT_THRESHOLDS: ReviewThresholds = {
  minQuestionsAttemptedPct: 40,
  minActiveDays: 10,
  minSpanDays: 14,
  maxCrammingPct: 30,
  maxWorkIncomeAnnual: 600_000, // 6 LPA
}

// The raw per-candidate signals the engine scores. Placeholder signals are optional
// and left undefined until their data pipeline lands.
export type CandidateSignals = {
  attemptedQuestions: number
  totalQuestions: number   // total quiz questions in the challenge (denominator for %)
  activeDays: number
  spanDays: number
  crammingPct: number
  // SES rubric answers, keyed by rawField (place_raw, marital_raw, …). Scored via lib/ses.
  sesAnswers?: Record<string, string | null | undefined>
  // Placeholder — not yet implemented → criterion is 'na'.
  keyQuestionScorePct?: number
  // Eligibility / straight-elimination gates, from the SensAI intake questions.
  // All undefined until the intake-answer pipeline lands (then they activate).
  collegeName?: string         // current college/institute — matched against the excluded list
  currentlyStudying?: boolean  // still in education? (not studying → available now)
  graduationYear?: number      // year current education completes (students only)
  courseType?: 'full_time' | 'part_time' | 'distance' | 'online' // current course type
  working?: boolean            // currently working?
  willingToQuit?: boolean      // willing to pause/leave work to fully commit?
  monthlySalaryInr?: number    // the candidate's own monthly salary/stipend (₹)
  familyAnnualIncomeInr?: number // total family income per year (₹)
  familySize?: number          // total people in the family (per-capita denominator)
}

// Regular (full-time / part-time) students must finish BY this year. Distance /
// online learners are exempt (they can join any time). Bump per cohort year.
export const GRAD_LATEST_YEAR = 2028

export type CriterionStatus = 'pass' | 'fail' | 'na'
// Need = socio-economic / financial-need gates; Work & Availability = capacity to
// commit; Engagement = challenge effort + performance.
export type CriterionGroup = 'need' | 'work_availability' | 'engagement'

export type CriterionResult = {
  key: string
  label: string
  group: CriterionGroup
  status: CriterionStatus
  value: string        // human-readable actual value ("21", "9 days", "n/a")
  threshold: string    // human-readable rule ("> 100", ">= 14 days")
  placeholder: boolean // true = criterion's data isn't wired yet (always 'na')
  internalOnly?: boolean // fail feedback is for the team only — NOT shown to the candidate
  failFeedback?: string  // shown on a fail (to the team always; to the candidate unless internalOnly)
  informational?: boolean // shown for context only — NEVER affects the system decision
  sesBreakdown?: SesBreakdownRow[] // SES criterion only — per-question answer/score/weight for drill-down
}

export type SystemDecision = 'selected' | 'rejected'

export type ReviewEvaluation = {
  criteria: CriterionResult[]
  systemDecision: SystemDecision
  // Feedback strings for every failed criterion — the codified rejection reasons.
  failReasons: string[]
}

// Evaluate one candidate. `systemDecision` is 'selected' iff every non-'na'
// criterion passes; a single fail rejects. Placeholder criteria never gate.
export function evaluateCandidate(
  signals: CandidateSignals,
  thresholds: ReviewThresholds = DEFAULT_THRESHOLDS,
): ReviewEvaluation {
  // Graduation gate:
  //   • not currently studying → available → pass
  //   • distance / online learner → flexible → pass at any completion year
  //   • regular (full/part-time) student → must finish by GRAD_LATEST_YEAR
  //   • completion year (or course type, for a late finisher) unknown → manual review
  const isFlexibleStudy = signals.courseType === 'distance' || signals.courseType === 'online'
  const isRegularStudy = signals.courseType === 'full_time' || signals.courseType === 'part_time'
  const gradStatus: CriterionStatus =
    signals.currentlyStudying === false
      ? 'pass'
      : isFlexibleStudy
        ? 'pass'
        : signals.graduationYear === undefined
          ? 'na'
          : signals.graduationYear <= GRAD_LATEST_YEAR
            ? 'pass'
            : isRegularStudy
              ? 'fail'
              : 'na' // finishing late, but course type unknown → can't apply the exception

  // Work gate:
  //   • not working → take → pass
  //   • working + earning above the income bar → reject (even if willing to quit)
  //   • working, at/below the bar, willing to quit → take → pass
  //   • working, at/below the bar, NOT willing → reject
  //   • working status / willingness unknown → manual review
  const workAnnualIncome = signals.monthlySalaryInr === undefined ? undefined : signals.monthlySalaryInr * 12
  const workStatus: CriterionStatus =
    signals.working === undefined
      ? 'na'
      : !signals.working
        ? 'pass'
        : workAnnualIncome !== undefined && workAnnualIncome > thresholds.maxWorkIncomeAnnual
          ? 'fail'
          : signals.willingToQuit === undefined
            ? 'na'
            : signals.willingToQuit
              ? 'pass'
              : 'fail'

  // College gate: eliminated if the candidate's college is on the excluded list.
  const college = (signals.collegeName ?? '').trim()
  const excluded = thresholds.excludedColleges ?? []
  const collegeStatus: CriterionStatus =
    !college || excluded.length === 0
      ? 'na'
      : isExcludedCollege(college, excluded)
        ? 'fail'
        : 'pass'

  // Share of the challenge's quiz questions this candidate attempted.
  const questionsAttemptedPct =
    signals.totalQuestions > 0 ? Math.round((signals.attemptedQuestions / signals.totalQuestions) * 100) : 0

  // SES: weighted socio-economic need score (higher = more needy). Pass when ≥ cutoff.
  const ses = signals.sesAnswers ? computeSes(signals.sesAnswers, thresholds.sesWeights) : null
  const sesStatus: CriterionStatus =
    !ses || ses.answered === 0 || thresholds.sesCutoff === undefined
      ? 'na'
      : ses.score >= thresholds.sesCutoff
        ? 'pass'
        : 'fail'

  // Per-capita family income = annual family income ÷ total family members.
  const perCapitaIncome =
    signals.familyAnnualIncomeInr !== undefined && signals.familySize
      ? Math.round(signals.familyAnnualIncomeInr / signals.familySize)
      : undefined

  const criteria: CriterionResult[] = [
    // ── Eligibility (straight-elimination / basic-fit gates) ──────────────────
    // SES — placeholder need-gate (not yet implemented).
    {
      key: 'ses',
      label: 'Financial need (SES)',
      group: 'need',
      placeholder: false, // wired — na = no SES answers or no cutoff set
      status: sesStatus,
      value: ses && ses.answered ? `${ses.score} / ${sesMaxScore(thresholds.sesWeights)}` : 'n/a',
      threshold:
        thresholds.sesCutoff === undefined
          ? 'SES cutoff not set yet'
          : `Weighted SES need score ≥ ${thresholds.sesCutoff} (of ${sesMaxScore(thresholds.sesWeights)})`,
      internalOnly: true,
      failFeedback: 'Our socio-economic assessment did not establish sufficient financial need.',
      sesBreakdown: ses?.breakdown,
    },
    {
      key: 'college',
      label: 'College',
      group: 'need',
      placeholder: false, // wired — na means no college answer or no excluded list set
      status: collegeStatus,
      value: college || 'n/a',
      threshold: 'College is not on the excluded-colleges list',
      internalOnly: true,
      failFeedback: 'Based on your current institution, this programme isn’t the right fit for you.',
    },
    {
      key: 'per_capita_income',
      label: 'Per-capita income',
      group: 'need',
      placeholder: false, // wired — na means missing income/size or threshold not set
      status:
        perCapitaIncome === undefined || thresholds.maxPerCapitaIncomeAnnual === undefined
          ? 'na'
          : perCapitaIncome < thresholds.maxPerCapitaIncomeAnnual
            ? 'pass'
            : 'fail',
      value:
        perCapitaIncome === undefined
          ? 'n/a'
          : `₹${perCapitaIncome.toLocaleString('en-IN')}/yr (₹${(signals.familyAnnualIncomeInr ?? 0).toLocaleString('en-IN')} ÷ ${signals.familySize} members)`,
      threshold:
        thresholds.maxPerCapitaIncomeAnnual === undefined
          ? 'Threshold not set yet'
          : `Family income ÷ family size below ₹${thresholds.maxPerCapitaIncomeAnnual.toLocaleString('en-IN')} per person / year`,
      internalOnly: true,
      failFeedback: 'Your family’s per-capita income is above the level this programme is aimed at.',
    },
    {
      key: 'graduation_timeline',
      label: 'Graduation timeline',
      group: 'work_availability',
      placeholder: false, // wired — na = late finisher with unknown course type / year
      status: gradStatus,
      value:
        signals.currentlyStudying === false
          ? 'Not studying'
          : `${signals.graduationYear ?? 'n/a'}${courseTypeShort(signals.courseType) ? ` · ${courseTypeShort(signals.courseType)}` : ''}`,
      threshold: `Distance/online: any year. Full-time/part-time: must finish by ${GRAD_LATEST_YEAR}`,
      failFeedback: `You’re a full-time/part-time student finishing after ${GRAD_LATEST_YEAR}, so you can’t commit to the programme in time.`,
    },
    {
      key: 'work_commitment',
      label: 'Work commitment',
      group: 'work_availability',
      placeholder: false, // wired — na = working status or willingness unknown
      status: workStatus,
      value:
        signals.working === undefined
          ? 'n/a'
          : !signals.working
            ? 'Not working'
            : `Working${signals.monthlySalaryInr !== undefined ? ` · ₹${signals.monthlySalaryInr}/mo` : ''}${
                signals.willingToQuit === true ? ' · will quit' : signals.willingToQuit === false ? ' · won’t quit' : ''
              }`,
      threshold: `Not working — or working, earning ≤ ${lpa(thresholds.maxWorkIncomeAnnual)} LPA, and willing to quit`,
      failFeedback: 'Fully committing to HVA means stepping away from other work, which wasn’t possible based on your answers.',
    },
    // ── Engagement (challenge effort + performance) ───────────────────────────
    {
      key: 'attempted_questions',
      label: 'Questions attempted',
      group: 'engagement',
      placeholder: false,
      status: questionsAttemptedPct >= thresholds.minQuestionsAttemptedPct ? 'pass' : 'fail',
      value: `${questionsAttemptedPct}% (${signals.attemptedQuestions}/${signals.totalQuestions})`,
      threshold: `At least ${thresholds.minQuestionsAttemptedPct}% of all quiz questions attempted`,
      failFeedback: `You attempted ${questionsAttemptedPct}% of the challenge questions; we look for at least ${thresholds.minQuestionsAttemptedPct}%.`,
    },
    {
      key: 'active_days',
      label: 'Active days',
      group: 'engagement',
      placeholder: false,
      status: signals.activeDays > thresholds.minActiveDays ? 'pass' : 'fail',
      value: `${signals.activeDays} days`,
      threshold: `Active on more than ${thresholds.minActiveDays} days`,
      failFeedback: `You were active on ${signals.activeDays} days; we look for more than ${thresholds.minActiveDays}.`,
    },
    {
      key: 'span',
      label: 'Span (first → last)',
      group: 'engagement',
      placeholder: false,
      status: signals.spanDays >= thresholds.minSpanDays ? 'pass' : 'fail',
      value: `${signals.spanDays} days`,
      threshold: `First-to-last activity spans at least ${thresholds.minSpanDays} days`,
      failFeedback: `You worked across ${signals.spanDays} days; we look for consistency over at least ${thresholds.minSpanDays} days.`,
    },
    {
      key: 'cramming',
      label: 'Cramming',
      group: 'engagement',
      placeholder: false,
      status: signals.crammingPct < thresholds.maxCrammingPct ? 'pass' : 'fail',
      value: `${signals.crammingPct}%`,
      threshold: `Under ${thresholds.maxCrammingPct}% of all work done on the single busiest day`,
      failFeedback: `Too much of your work was crammed into one day (${signals.crammingPct}%); we look for steadier effort.`,
    },
    // Challenge-question score — INFORMATIONAL only. % of questions passed across
    // the "[Coding] Challenges" tasks. Shown for context; never gates a decision.
    {
      key: 'key_question_score',
      label: 'Challenge-question score',
      group: 'engagement',
      placeholder: false,
      informational: true,
      status: signals.keyQuestionScorePct === undefined ? 'na' : 'pass',
      value: signals.keyQuestionScorePct === undefined ? 'n/a' : `${signals.keyQuestionScorePct}% passed`,
      threshold: 'For information only — not used to select or reject',
    },
  ]

  // Informational criteria are shown for context but NEVER affect the decision.
  const graded = criteria.filter((c) => c.status !== 'na' && !c.informational)
  const systemDecision: SystemDecision = graded.every((c) => c.status === 'pass') ? 'selected' : 'rejected'
  const failReasons = criteria
    .filter((c) => c.status === 'fail' && !c.informational && c.failFeedback)
    .map((c) => c.failFeedback!)

  return { criteria, systemDecision, failReasons }
}
