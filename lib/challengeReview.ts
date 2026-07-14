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
  // Consistency: (span − active days) must be < this — at most (N−1) idle days
  // between first and last activity.
  maxGapDays: number
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
  // Criterion keys switched OFF — a disabled rule is shown but does NOT gate.
  disabledRules?: string[]
  // Cohort challenge end date (ISO date). Once it passes, everyone is "finished" and
  // gets evaluated (backstop for never-started learners). Undefined = only the
  // per-candidate 14-day window applies.
  challengeEndDate?: string
}

// The gating criteria the team can toggle on/off (informational ones excluded).
export const GATING_RULES: { key: string; label: string }[] = [
  { key: 'ses', label: 'Financial need (SES)' },
  { key: 'college', label: 'College' },
  { key: 'per_capita_income', label: 'Per-capita income' },
  { key: 'graduation_timeline', label: 'Graduation timeline' },
  { key: 'work_commitment', label: 'Work commitment' },
  { key: 'attempted_questions', label: 'Items attempted' },
  { key: 'active_days', label: 'Active days' },
  { key: 'span', label: 'Span' },
  { key: 'cramming', label: 'Cramming' },
  { key: 'consistency', label: 'Gap days' },
]

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
  maxGapDays: 4, // span − active < 4 → at most 3 idle days
  maxWorkIncomeAnnual: 600_000, // 6 LPA
}

// The raw per-candidate signals the engine scores. Placeholder signals are optional
// and left undefined until their data pipeline lands.
export type CandidateSignals = {
  attemptedQuestions: number
  totalQuestions: number   // total quiz questions in the challenge
  // Items = reading tasks + quiz questions. The "attempted" gate measures against
  // ALL items (the 320) for consistency with the rest of the challenge views.
  attemptedItems: number
  totalItems: number
  activeDays: number
  spanDays: number
  crammingPct: number
  // Has the candidate FINISHED the 14-day challenge? (14 days since their first
  // activity, or the cohort end date passed.) Undefined = treat as finished. When
  // false, the system returns 'in_progress' and NO rules gate.
  challengeFinished?: boolean
  // SES rubric answers, keyed by rawField (place_raw, marital_raw, …). Scored via lib/ses.
  sesAnswers?: Record<string, string | null | undefined>
  // Informational (never gates): % of "[Coding] Challenges" questions passed, and
  // the actual average grader score across them (0–4 scale).
  keyQuestionScorePct?: number
  keyQuestionAvgScore?: number
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

// The challenge is 14 days. A candidate has FINISHED once their 14-day window has
// elapsed (with SensAI's daily drip they can't finish sooner), or the cohort end
// date has passed. Until then they're 'in_progress' and no rules run.
export const CHALLENGE_LENGTH_DAYS = 14

export function isChallengeFinished(
  firstActive: string | null,
  nowMs: number,
  challengeEndDate?: string,
): boolean {
  // Cohort backstop — end date passed → the whole cohort is finished (covers
  // never-started learners, who have no personal window).
  if (challengeEndDate) {
    const end = new Date(`${challengeEndDate}T23:59:59Z`).getTime()
    if (Number.isFinite(end) && nowMs > end) return true
  }
  // Per-candidate — their 14-day window (from first activity) has elapsed.
  if (firstActive) {
    const start = new Date(firstActive).getTime()
    if (Number.isFinite(start) && (nowMs - start) / 86_400_000 >= CHALLENGE_LENGTH_DAYS) return true
  }
  return false
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
  sortValue?: number     // numeric criteria only — the raw value to sort the column by (undefined = no data)
  // true = na because the gate is ACTIVE but this candidate's own data is missing /
  // unparseable (vs na because the gate isn't configured). Blocks auto-select →
  // 'review'. A not-yet-configured gate is NOT undetermined (stays neutral).
  undetermined?: boolean
  disabled?: boolean // rule switched off in config — shown but does NOT gate
}

// 'in_progress' = the candidate hasn't FINISHED the 14-day challenge yet, so NO
// rules are evaluated (mid-challenge learners can't fail the 14-day-window rules).
// 'review' = finished + can't auto-decide (a gate is undetermined — data missing).
export type SystemDecision = 'selected' | 'rejected' | 'review' | 'in_progress'

export type ReviewEvaluation = {
  criteria: CriterionResult[]
  systemDecision: SystemDecision
  // Feedback strings for every failed criterion — the codified rejection reasons.
  failReasons: string[]
}

// A neutral, humane fallback shown when there's no drafted reason to give (e.g. the
// only fails are cramming / key-question, or the team overrode a system select).
export const GENERIC_REJECTION_MESSAGE =
  'Thank you for taking on the 14-Day Challenge — we really appreciate the effort you put in. After careful review, we won’t be moving forward with your application this time. We’d genuinely encourage you to keep building on your skills and apply again in the future.'

const ORBIT_LINK = 'https://sensai.hyperverge.org/school/hvacademy/join?cohortId=129'

// Candidate-facing rejection message per criterion key. {Name} → first name,
// {X} → the reason's number (active days / span days / gap days). Filled when the
// drawer opens (editable before release). Keys without a template fall back to
// GENERIC_REJECTION_MESSAGE. These are the candidate-safe versions of the sensitive
// gates too (SES / college / income) — the raw failFeedback stays internal.
export const REJECTION_TEMPLATES: Record<string, string> = {
  ses: `Hi {Name}, thank you for completing the 14-day challenge with us. HVA is a free fellowship designed to prioritize learners with the highest need for this opportunity. Based on our current selection criteria, we’re unable to offer you a seat this cycle, as we have limited spots and many other applicants with equally strong or greater need. We’d still love to have you with us through our Orbit Track — a self-paced programme open to a wider group of learners: ${ORBIT_LINK}`,
  college: `Hi {Name}, thank you for your interest in HVA and for completing the challenge. Since our program is designed to support learners who currently have limited access to strong placement opportunities, and your college has a good placement track record, we believe you’re already well-positioned for outcomes similar to what HVA offers. We’d rather use this seat for someone who doesn’t have that access. If you’d still like to build these skills, our Orbit Track is a self-paced option you’re welcome to join: ${ORBIT_LINK}`,
  per_capita_income: `Hi {Name}, thank you for completing the 14-day challenge. As a free fellowship with limited seats, we prioritize learners with the greatest need for this kind of support. This cycle, we’re unable to move forward with your application, as we have other candidates whose circumstances make this opportunity more critical for them. We’d love for you to continue learning with us through our Orbit Track, a self-paced programme: ${ORBIT_LINK}`,
  graduation_timeline: `Hi {Name}, thank you for completing the 14-day challenge with us. HVA is designed for learners who are close to entering the workforce, and we prioritize candidates who will be ready to work within the next year. Since your expected graduation is a little further out, we’re unable to offer you a seat in this cohort. We’d encourage you to apply again closer to your graduation — we’d love to have you then! If you’d still like to build these skills, our Orbit Track is a self-paced option you’re welcome to join: ${ORBIT_LINK}`,
  work_commitment: `Hi {Name}, thank you for completing the 14-day challenge. HVA requires full-time commitment from learners for the duration of the fellowship, and based on your current work situation, we don’t think this is the right time for you to take this on. We don’t want to set you up for a difficult trade-off. Good news — our Orbit Track is self-paced and designed for exactly this kind of situation, so you can upskill alongside your job: ${ORBIT_LINK}`,
  attempted_questions: `Hi {Name}, thank you for participating in the 14-day challenge. We noticed a few tasks and related reading materials weren’t completed, which are an important part of how we assess readiness for the program. We’re unable to offer you a seat this cycle, but we’d love for you to try our Orbit Track, a self-paced programme where you can move through the material at your own pace: ${ORBIT_LINK}`,
  active_days: `Hi {Name}, thank you for taking part in the 14-day challenge. Regular, daily engagement is something we look closely at, since it reflects the consistency the fellowship demands. We noticed limited activity on {X} out of the 14 days, so we’re unable to offer you a seat this cycle. Our Orbit Track could be a great fit instead — it’s self-paced, so you can engage on a schedule that works better for you: ${ORBIT_LINK}`,
  span: `Hi {Name}, thank you for completing the 14-day challenge. We noticed it took {X} days to finish the challenge, longer than the expected window, which makes it harder for us to gauge your pace and readiness for the program’s intensity. We’re unable to offer you a seat this cycle, but our Orbit Track is a self-paced alternative that might suit your pace better: ${ORBIT_LINK}`,
  consistency: `Hi {Name}, thank you for completing the 14-day challenge. We noticed a gap of more than {X} days where there was no activity on SensAI. Since consistent engagement is key to succeeding in the fellowship, we’re unable to offer you a seat this cycle. We’d love for you to check out our Orbit Track instead — a self-paced programme with more flexibility: ${ORBIT_LINK}`,
}

// The {X} number for a reason (null when the template has no {X}).
function rejectionX(key: string, s: CandidateSignals): number | null {
  if (key === 'active_days') return s.activeDays
  if (key === 'span') return s.spanDays
  if (key === 'consistency') return Math.max(0, s.spanDays - s.activeDays)
  return null
}

/** Substitute {Name}/{X} in a rejection template. */
export function fillRejectionMessage(template: string, name: string, key: string, signals: CandidateSignals): string {
  const first = (name ?? '').trim().split(' ')[0] || 'there'
  const x = rejectionX(key, signals)
  return template.replace(/\{Name\}/g, first).replace(/\{X\}/g, x == null ? '' : String(x))
}

export type RejectionReason = { key: string; label: string; message: string }

// The reason "types" offered on rejection: each failed criterion that HAS a drafted
// template, filled for this candidate. Ordered most-relevant-first (criteria order),
// so the first is the sensible default. Always ends with a 'general' fallback.
export function candidateRejectionReasons(
  criteria: CriterionResult[],
  ctx: { name: string; signals: CandidateSignals },
): RejectionReason[] {
  const specific = criteria
    .filter((c) => c.status === 'fail' && !c.disabled && !c.informational && REJECTION_TEMPLATES[c.key])
    .map((c) => ({ key: c.key, label: c.label, message: fillRejectionMessage(REJECTION_TEMPLATES[c.key], ctx.name, c.key, ctx.signals) }))
  return [...specific, { key: 'general', label: 'General (no specific reason)', message: GENERIC_REJECTION_MESSAGE }]
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

  // Share of ALL challenge items (reading + questions) this candidate attempted.
  const itemsAttemptedPct =
    signals.totalItems > 0 ? Math.round((signals.attemptedItems / signals.totalItems) * 100) : 0

  // Consistency: idle days between first and last activity.
  const gapDays = Math.max(0, signals.spanDays - signals.activeDays)

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
      sortValue: ses && ses.answered ? ses.score : undefined,
      // Cutoff set but no SES answers → data missing → blocks auto-select.
      undetermined: sesStatus === 'na' && thresholds.sesCutoff !== undefined,
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
      // Excluded list configured but no college answer → data missing → blocks auto-select.
      undetermined: collegeStatus === 'na' && excluded.length > 0,
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
      sortValue: perCapitaIncome,
      // Threshold set but income/size missing → data missing → blocks auto-select.
      undetermined: perCapitaIncome === undefined && thresholds.maxPerCapitaIncomeAnnual !== undefined,
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
      undetermined: gradStatus === 'na', // no config gate — any na is missing candidate data
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
      undetermined: workStatus === 'na', // no config gate — any na is missing candidate data
    },
    // ── Engagement (challenge effort + performance) ───────────────────────────
    {
      key: 'attempted_questions',
      label: 'Items attempted',
      group: 'engagement',
      placeholder: false,
      status: itemsAttemptedPct >= thresholds.minQuestionsAttemptedPct ? 'pass' : 'fail',
      value: `${itemsAttemptedPct}% (${signals.attemptedItems}/${signals.totalItems})`,
      threshold: `At least ${thresholds.minQuestionsAttemptedPct}% of all challenge items (reading + questions) attempted`,
      failFeedback: `You attempted ${itemsAttemptedPct}% of the challenge items; we look for at least ${thresholds.minQuestionsAttemptedPct}%.`,
      sortValue: itemsAttemptedPct,
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
      sortValue: signals.activeDays,
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
      sortValue: signals.spanDays,
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
      sortValue: signals.crammingPct,
    },
    {
      // Consistency = idle days between first and last activity (span − active days).
      key: 'consistency',
      label: 'Gap days',
      group: 'engagement',
      placeholder: false,
      status: gapDays < thresholds.maxGapDays ? 'pass' : 'fail',
      value: `${gapDays} gap days`,
      threshold: `Fewer than ${thresholds.maxGapDays} idle days between first and last activity`,
      failFeedback: `Your activity had ${gapDays} idle days between sessions; we look for steadier day-to-day engagement.`,
      sortValue: gapDays,
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
      value:
        signals.keyQuestionScorePct === undefined
          ? 'n/a'
          : signals.keyQuestionAvgScore !== undefined
            ? `avg ${signals.keyQuestionAvgScore}/4 · ${signals.keyQuestionScorePct}% passed`
            : `${signals.keyQuestionScorePct}% passed`,
      threshold: 'For information only — not used to select or reject',
      sortValue: signals.keyQuestionAvgScore ?? signals.keyQuestionScorePct,
    },
  ]

  // Mark rules the team switched off — shown but non-gating.
  const disabledSet = new Set(thresholds.disabledRules ?? [])
  for (const c of criteria) if (disabledSet.has(c.key)) c.disabled = true

  // Informational + disabled criteria are shown for context but NEVER affect the
  // decision. Precedence: still mid-challenge → 'in_progress' (no rules run — the
  // 14-day-window rules can't be judged yet); otherwise a hard FAIL rejects; an
  // UNDETERMINED gate (candidate data missing on an active gate) → 'review'; every
  // gate passes → 'selected'. A not-yet-configured gate ('na' but not undetermined)
  // stays neutral, so unconfigured gates don't flag everyone.
  const gating = criteria.filter((c) => !c.informational && !c.disabled)
  const systemDecision: SystemDecision =
    signals.challengeFinished === false
      ? 'in_progress'
      : gating.some((c) => c.status === 'fail')
        ? 'rejected'
        : gating.some((c) => c.undetermined)
          ? 'review'
          : 'selected'
  // No codified reasons while in progress (they're not being rejected).
  const failReasons =
    systemDecision === 'in_progress'
      ? []
      : criteria
          .filter((c) => c.status === 'fail' && !c.informational && !c.disabled && c.failFeedback)
          .map((c) => c.failFeedback!)

  return { criteria, systemDecision, failReasons }
}
