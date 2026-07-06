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
  graduationYear?: number      // year current education completes
  studyMode?: 'full_time' | 'part_time'
  working?: boolean            // currently working?
  willingToQuit?: boolean      // willing to pause/leave work to fully commit?
  monthlySalaryInr?: number    // current monthly salary/stipend (₹)
}

// Full-time students finishing in this year or later are too far from being
// placeable to commit now (part-timers finishing late are still fine). Bump per
// cohort year as needed.
export const FULL_TIME_GRAD_CUTOFF_YEAR = 2028
// > 6 LPA is outside the need profile this programme targets.
export const INCOME_CEILING_ANNUAL_INR = 600_000

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
  // Graduation gate: fine if finishing before the cutoff; if finishing at/after it,
  // full-time is eliminated but part-time can proceed; unknown mode → manual review.
  const gradStatus: CriterionStatus =
    signals.graduationYear === undefined
      ? 'na'
      : signals.graduationYear < FULL_TIME_GRAD_CUTOFF_YEAR
        ? 'pass'
        : signals.studyMode === 'full_time'
          ? 'fail'
          : signals.studyMode === 'part_time'
            ? 'pass'
            : 'na'

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

  const annualIncome = signals.monthlySalaryInr === undefined ? undefined : signals.monthlySalaryInr * 12

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
      key: 'graduation_timeline',
      label: 'Graduation timeline',
      group: 'work_availability',
      placeholder: false, // wired — na here means not-a-current-student / mode unknown
      status: gradStatus,
      value:
        signals.graduationYear === undefined
          ? 'n/a'
          : `${signals.graduationYear}${signals.studyMode ? ` · ${signals.studyMode === 'full_time' ? 'FT' : 'PT'}` : ''}`,
      threshold: `Before ${FULL_TIME_GRAD_CUTOFF_YEAR}, or part-time`,
      failFeedback: `Full-time students finishing in ${FULL_TIME_GRAD_CUTOFF_YEAR} or later can’t commit enough time to the programme right now.`,
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
    {
      key: 'income_ceiling',
      label: 'Income ceiling',
      group: 'need',
      placeholder: false, // wired — na here means no salary answer
      status: annualIncome === undefined ? 'na' : annualIncome > INCOME_CEILING_ANNUAL_INR ? 'fail' : 'pass',
      value: signals.monthlySalaryInr === undefined ? 'n/a' : `₹${signals.monthlySalaryInr}/mo`,
      threshold: '≤ 6 LPA',
      internalOnly: true,
      failFeedback: 'This programme is aimed at candidates below a certain income level.',
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
