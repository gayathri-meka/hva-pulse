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

// SAFETY LOCK — while false, the admin Select/Reject actions (drawer + bulk) are
// greyed out so no one records a verdict by mistake (which would surface to the
// candidate). Flip to true once the team is ready to start deciding.
export const REVIEW_DECISIONS_ENABLED = false

export type ReviewThresholds = {
  minAttemptedQuestions: number // attempted questions must be > this
  minActiveDays: number         // active days must be > this
  minSpanDays: number           // span (first→last, inclusive) must be >= this
  maxCrammingPct: number        // cramming % must be < this
  // Per-capita family income (annual) must be BELOW this to establish need.
  // Undefined = not configured yet → the per-capita criterion stays 'na'.
  maxPerCapitaIncomeAnnual?: number
}

export const DEFAULT_THRESHOLDS: ReviewThresholds = {
  minAttemptedQuestions: 100,
  minActiveDays: 10,
  minSpanDays: 14,
  maxCrammingPct: 30,
}

// The raw per-candidate signals the engine scores. Placeholder signals are optional
// and left undefined until their data pipeline lands.
export type CandidateSignals = {
  attemptedQuestions: number
  activeDays: number
  spanDays: number
  crammingPct: number
  // Placeholders — undefined = not yet implemented → criterion is 'na'.
  ses?: 'pass' | 'fail'
  keyQuestionScorePct?: number
  // Eligibility / straight-elimination gates, from the SensAI intake questions.
  // All undefined until the intake-answer pipeline lands (then they activate).
  collegeTier?: 1 | 2 | 3      // Tier 1 / Tier 2 institutions are eliminated
  currentlyStudying?: boolean  // still in education? (not studying → available now)
  graduationYear?: number      // year current education completes (students only)
  working?: boolean            // currently working?
  willingToQuit?: boolean      // willing to pause/leave work to fully commit?
  familyAnnualIncomeInr?: number // total family income per year (₹)
  familySize?: number          // total people in the family (per-capita denominator)
}

// Students finishing in this year or later can't commit in time — it's a no-go.
// Anyone graduating before it (or not currently studying) is available. Bump per
// cohort year as needed.
export const GRAD_CUTOFF_YEAR = 2028

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
  // Graduation gate: not currently studying → available → pass; else gate on the
  // completion year (>= cutoff is a no-go); unknown year for a student → manual review.
  const gradStatus: CriterionStatus =
    signals.currentlyStudying === false
      ? 'pass'
      : signals.graduationYear === undefined
        ? 'na'
        : signals.graduationYear >= GRAD_CUTOFF_YEAR
          ? 'fail'
          : 'pass'

  // Work gate: not working is fine; working + unwilling to leave is eliminated;
  // working + willing is fine; willingness unknown → manual review.
  const workStatus: CriterionStatus =
    signals.working === undefined
      ? 'na'
      : !signals.working
        ? 'pass'
        : signals.willingToQuit === undefined
          ? 'na'
          : signals.willingToQuit
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
      placeholder: true, // pipeline not built yet
      status: signals.ses === undefined ? 'na' : signals.ses,
      value: signals.ses === undefined ? 'n/a' : signals.ses === 'pass' ? 'Need established' : 'No need',
      threshold: 'Need established',
      internalOnly: true,
      failFeedback: 'Our socio-economic assessment did not establish financial need.',
    },
    {
      key: 'college_tier',
      label: 'College tier',
      group: 'need',
      placeholder: true, // needs a Tier 1/2 college list to classify — not built yet
      status: signals.collegeTier === undefined ? 'na' : signals.collegeTier <= 2 ? 'fail' : 'pass',
      value: signals.collegeTier === undefined ? 'n/a' : `Tier ${signals.collegeTier}`,
      threshold: 'Not Tier 1 / Tier 2',
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
      value: perCapitaIncome === undefined ? 'n/a' : `₹${perCapitaIncome.toLocaleString('en-IN')}/yr`,
      threshold:
        thresholds.maxPerCapitaIncomeAnnual === undefined
          ? 'not set'
          : `< ₹${thresholds.maxPerCapitaIncomeAnnual.toLocaleString('en-IN')}/yr`,
      internalOnly: true,
      failFeedback: 'Your family’s per-capita income is above the level this programme is aimed at.',
    },
    {
      key: 'graduation_timeline',
      label: 'Graduation timeline',
      group: 'work_availability',
      placeholder: false, // wired — na here means a student whose completion year is unknown
      status: gradStatus,
      value:
        signals.currentlyStudying === false
          ? 'Not studying'
          : signals.graduationYear === undefined
            ? 'n/a'
            : String(signals.graduationYear),
      threshold: `Finishing by ${GRAD_CUTOFF_YEAR - 1}`,
      failFeedback: `You’re set to finish your current education in ${GRAD_CUTOFF_YEAR} or later, so you can’t commit to the programme in time.`,
    },
    {
      key: 'work_commitment',
      label: 'Work commitment',
      group: 'work_availability',
      placeholder: false, // wired — na here means no answer / willingness unknown
      status: workStatus,
      value:
        signals.working === undefined
          ? 'n/a'
          : !signals.working
            ? 'Not working'
            : signals.willingToQuit === undefined
              ? 'Working · ?'
              : signals.willingToQuit
                ? 'Working · will commit'
                : 'Working · won’t leave',
      threshold: 'Not working, or willing to fully commit',
      failFeedback: 'Fully committing to HVA means stepping away from other work, which you weren’t able to do.',
    },
    // ── Engagement (challenge effort + performance) ───────────────────────────
    {
      key: 'attempted_questions',
      label: 'Questions attempted',
      group: 'engagement',
      placeholder: false,
      status: signals.attemptedQuestions > thresholds.minAttemptedQuestions ? 'pass' : 'fail',
      value: String(signals.attemptedQuestions),
      threshold: `> ${thresholds.minAttemptedQuestions}`,
      failFeedback: `You attempted ${signals.attemptedQuestions} questions; we look for more than ${thresholds.minAttemptedQuestions}.`,
    },
    {
      key: 'active_days',
      label: 'Active days',
      group: 'engagement',
      placeholder: false,
      status: signals.activeDays > thresholds.minActiveDays ? 'pass' : 'fail',
      value: `${signals.activeDays} days`,
      threshold: `> ${thresholds.minActiveDays} days`,
      failFeedback: `You were active on ${signals.activeDays} days; we look for more than ${thresholds.minActiveDays}.`,
    },
    {
      key: 'span',
      label: 'Span (first → last)',
      group: 'engagement',
      placeholder: false,
      status: signals.spanDays >= thresholds.minSpanDays ? 'pass' : 'fail',
      value: `${signals.spanDays} days`,
      threshold: `>= ${thresholds.minSpanDays} days`,
      failFeedback: `You worked across ${signals.spanDays} days; we look for consistency over at least ${thresholds.minSpanDays} days.`,
    },
    {
      key: 'cramming',
      label: 'Cramming',
      group: 'engagement',
      placeholder: false,
      status: signals.crammingPct < thresholds.maxCrammingPct ? 'pass' : 'fail',
      value: `${signals.crammingPct}%`,
      threshold: `< ${thresholds.maxCrammingPct}%`,
      failFeedback: `Too much of your work was crammed into one day (${signals.crammingPct}%); we look for steadier effort.`,
    },
    // Key-question score — placeholder (needs per-selected-question scores synced).
    {
      key: 'key_question_score',
      label: 'Key-question score',
      group: 'engagement',
      placeholder: true, // per-selected-question scores not synced yet
      status: 'na',
      value: signals.keyQuestionScorePct === undefined ? 'n/a' : `${signals.keyQuestionScorePct}%`,
      threshold: 'TBD',
      failFeedback: 'Your scores on the key challenge questions were below the bar.',
    },
  ]

  const graded = criteria.filter((c) => c.status !== 'na')
  const systemDecision: SystemDecision = graded.every((c) => c.status === 'pass') ? 'selected' : 'rejected'
  const failReasons = criteria.filter((c) => c.status === 'fail' && c.failFeedback).map((c) => c.failFeedback!)

  return { criteria, systemDecision, failReasons }
}
