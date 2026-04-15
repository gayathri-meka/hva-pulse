/**
 * Generates analysis_text for each learner — insight-first, not template-first.
 *
 * Structure per learner:
 *   1. Key Finding — one-sentence summary of what matters most
 *   2. Evidence — data points supporting the finding
 *   3. Comparison to Cohort — percentile/rank on key metrics
 *   4. Specific Gaps — actionable topic list
 *
 * Requires: raw_data already populated via run-learner-analysis.ts
 *
 * Usage: npx tsx scripts/write-analysis.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Types ────────────────────────────────────────────────────────────────────

type CourseSummary = {
  course_name: string; question_type: string
  total_attempts: string; distinct_questions: string
  passed_attempts: string; first_attempt_passed: string
  first_attempt_pass_rate: string; avg_first_score: string
  retries: string; questions_never_first_passed: string
}

type WeakArea = {
  course_name: string; milestone_name: string
  questions: string; first_pass: string
  first_pass_rate: string; avg_first_score: string
}

type Progression = {
  course_name: string; milestone_name: string; question_title: string
  total_attempts: string; score_progression: string; times_passed: string
}

type FeedbackSample = {
  course_name: string; milestone_name: string; question_title: string
  score: string; wrong_feedback: string
}

type ActivityRow = {
  week: string; course_name: string
  attempts: string; passed: string; distinct_questions: string
}

type RawData = {
  course_summary: CourseSummary[]
  weakest_areas: WeakArea[]
  score_progressions: Progression[]
  feedback_samples: FeedbackSample[]
  activity_timeline: ActivityRow[]
}

function n(v: string | null | undefined): number {
  return parseFloat(v ?? '0') || 0
}

// ── Cohort stats (computed once across all learners) ─────────────────────────

type CohortStats = {
  firstPassRates: Map<string, number[]> // course+type → array of rates (one per learner)
  avgFirstScores: Map<string, number[]>
  overallFirstPassRates: number[]
  bruteForceCountsPerLearner: number[]
  totalQuestionsPerLearner: number[]
}

function buildCohortStats(allLearners: { email: string; raw: RawData }[]): CohortStats {
  const firstPassRates = new Map<string, number[]>()
  const avgFirstScores = new Map<string, number[]>()
  const overallFirstPassRates: number[] = []
  const bruteForceCountsPerLearner: number[] = []
  const totalQuestionsPerLearner: number[] = []

  for (const { raw } of allLearners) {
    const cs = raw.course_summary ?? []
    if (cs.length === 0) continue

    // Overall first pass rate for this learner
    const totalFirst = cs.reduce((s, c) => s + n(c.first_attempt_passed), 0)
    const totalQs    = cs.reduce((s, c) => s + n(c.distinct_questions), 0)
    if (totalQs > 0) {
      overallFirstPassRates.push(Math.round((totalFirst / totalQs) * 100))
      totalQuestionsPerLearner.push(totalQs)
    }

    // Per course+type
    for (const c of cs) {
      const key = c.course_name + '|' + c.question_type
      const rate = n(c.first_attempt_pass_rate)
      if (!firstPassRates.has(key)) firstPassRates.set(key, [])
      firstPassRates.get(key)!.push(rate)
      if (c.avg_first_score) {
        if (!avgFirstScores.has(key)) avgFirstScores.set(key, [])
        avgFirstScores.get(key)!.push(n(c.avg_first_score))
      }
    }

    // Brute-force count
    const bf = countBruteForce(raw.score_progressions ?? [])
    bruteForceCountsPerLearner.push(bf)
  }

  return { firstPassRates, avgFirstScores, overallFirstPassRates, bruteForceCountsPerLearner, totalQuestionsPerLearner }
}

function percentile(value: number, distribution: number[]): number {
  const sorted = [...distribution].sort((a, b) => a - b)
  const below = sorted.filter((v) => v < value).length
  return Math.round((below / sorted.length) * 100)
}

// ── Pattern detection ────────────────────────────────────────────────────────

function countBruteForce(progressions: Progression[]): number {
  return progressions.filter((p) => isBruteForce(p)).length
}

function isBruteForce(p: Progression): boolean {
  const parts = (p.score_progression ?? '').split(' -> ')
  if (parts.length < 4) return false
  const scores = parts.map((s) => {
    const [num, den] = s.split('/')
    return den ? parseFloat(num) / parseFloat(den) : 0
  })
  const earlyScores = scores.slice(0, -1)
  const lastScore = scores[scores.length - 1]
  const avgEarly = earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length
  return avgEarly < 0.5 && lastScore >= 0.9 && earlyScores.length >= 3
}

function detectArchetype(
  overallFirstPass: number,
  bruteForceCount: number,
  totalQuestions: number,
  daysSinceActive: number,
  codingCourseCount: number,
  tooCleanScore: number, // 0-1: how "too perfect" the pattern is
): string {
  if (daysSinceActive > 21) return 'ghoster'
  // Brute-force rate: bf patterns relative to total questions attempted
  const bfRate = totalQuestions > 0 ? (bruteForceCount / totalQuestions) * 100 : 0
  if (bruteForceCount >= 10 && bfRate > 0.5 && overallFirstPass < 70) return 'grinder'
  if (bruteForceCount >= 15) return 'grinder'
  // Too clean: high first-pass + very few retries + high score = suspiciously perfect
  if (tooCleanScore >= 0.7 && overallFirstPass >= 80) return 'too-clean'
  if (totalQuestions < 100 && codingCourseCount <= 1) return 'skimmer'
  if (overallFirstPass < 55) return 'struggler'
  if (overallFirstPass < 65) return 'needs-improvement'
  return 'steady'
}

/** Compute how "too clean" a learner's pattern is (0-1).
 *  High score = suspiciously perfect. Based on:
 *  - First-attempt pass rate very high (>85%)
 *  - Very low retry ratio (few retries relative to questions)
 *  - Almost no partial scores on subjective (always 4/4 or 0/4, rarely 2/4 or 3/4) */
function computeTooCleanScore(cs: CourseSummary[], sp: Progression[]): number {
  const codingSubj = cs.filter((c) =>
    ['Coding in Python', 'Web Development', 'React', 'Backend'].includes(c.course_name)
    && c.question_type === 'subjective'
  )
  if (codingSubj.length === 0) return 0

  const totalQs     = codingSubj.reduce((s, c) => s + n(c.distinct_questions), 0)
  const totalFirst   = codingSubj.reduce((s, c) => s + n(c.first_attempt_passed), 0)
  const totalRetries = codingSubj.reduce((s, c) => s + n(c.retries), 0)
  if (totalQs < 50) return 0 // not enough data

  const firstPassRate = totalQs > 0 ? totalFirst / totalQs : 0
  const retryRatio    = totalQs > 0 ? totalRetries / totalQs : 0

  // Check for bimodal scores: mostly full marks or zero, few partials
  // Look at progressions — if first attempt is almost always 4/4, that's suspicious
  let perfectFirst = 0
  let totalSubjProgressions = 0
  for (const p of sp) {
    const parts = (p.score_progression ?? '').split(' -> ')
    if (parts.length === 0) continue
    const first = parts[0]
    const [num, den] = first.split('/')
    if (!den) continue
    totalSubjProgressions++
    if (parseFloat(num) / parseFloat(den) >= 0.95) perfectFirst++
  }
  const perfectFirstRate = totalSubjProgressions > 0 ? perfectFirst / totalSubjProgressions : 0

  // Composite score: weight each signal
  let score = 0
  if (firstPassRate >= 0.85) score += 0.35
  else if (firstPassRate >= 0.80) score += 0.2
  if (retryRatio < 0.15) score += 0.25
  else if (retryRatio < 0.25) score += 0.1
  if (perfectFirstRate >= 0.7) score += 0.4
  else if (perfectFirstRate >= 0.5) score += 0.2

  return Math.min(score, 1)
}

const ARCHETYPE_LABELS: Record<string, string> = {
  grinder:           'The Grinder — does the work but brute-forces through without deep learning',
  ghoster:           'The Ghoster — was active but has gone silent recently',
  skimmer:           'The Skimmer — limited engagement, covering very few courses/topics',
  struggler:         'The Struggler — genuinely low scores, needs fundamental support',
  'needs-improvement': 'Needs Improvement — below average but showing effort',
  'too-clean':       'Too Clean — suspiciously perfect scores, possible external help',
  steady:            'Steady — consistent performance, no major red flags',
}

// ── Feedback theme extraction ────────────────────────────────────────────────

function extractFeedbackThemes(samples: FeedbackSample[]): { theme: string; count: number; pct: number; example: string }[] {
  const patterns: [RegExp, string][] = [
    [/edge case|single.element|empty|boundary/i, 'Edge case handling'],
    [/negative|zero|0/i, 'Negative/zero handling'],
    [/logic|incorrect|wrong condition/i, 'Logic errors'],
    [/constraint|violat|not allowed/i, 'Not following constraints'],
    [/print|output|format|space/i, 'Output formatting'],
    [/loop|iteration|while|for/i, 'Loop/iteration issues'],
    [/undefined|null|NaN|uninitialized/i, 'Undefined/null handling'],
    [/duplicate|unique/i, 'Duplicate handling'],
    [/index|range|out of bounds/i, 'Index/range errors'],
  ]

  const total = samples.length
  if (total === 0) return []

  const themes: { theme: string; count: number; pct: number; example: string }[] = []
  for (const [regex, label] of patterns) {
    const matches = samples.filter((s) => regex.test(s.wrong_feedback ?? ''))
    if (matches.length > 0) {
      themes.push({
        theme: label,
        count: matches.length,
        pct: Math.round((matches.length / total) * 100),
        example: (matches[0].wrong_feedback ?? '').substring(0, 150),
      })
    }
  }
  return themes.sort((a, b) => b.count - a.count)
}

// ── Analysis writer ──────────────────────────────────────────────────────────

function writeAnalysis(name: string, raw: RawData, cohort: CohortStats): string {
  const cs = raw.course_summary ?? []
  const wa = raw.weakest_areas ?? []
  const sp = raw.score_progressions ?? []
  const fb = raw.feedback_samples ?? []
  const at = raw.activity_timeline ?? []

  if (cs.length === 0) return 'No sensai activity data found for this learner.'

  const lines: string[] = []

  // Compute learner-level stats
  const totalFirst  = cs.reduce((s, c) => s + n(c.first_attempt_passed), 0)
  const totalQs     = cs.reduce((s, c) => s + n(c.distinct_questions), 0)
  const totalRetries = cs.reduce((s, c) => s + n(c.retries), 0)
  const overallFirstPass = totalQs > 0 ? Math.round((totalFirst / totalQs) * 100) : 0
  const bruteForceCount  = countBruteForce(sp)
  const codingCourses    = cs.filter((c) =>
    ['Coding in Python', 'Web Development', 'React', 'Backend'].includes(c.course_name)
  )
  const codingCourseNames = [...new Set(codingCourses.map((c) => c.course_name))]

  // Activity
  const weeks = [...new Set(at.map((a) => a.week))].sort()
  const lastActiveWeek = weeks.length > 0 ? weeks[weeks.length - 1] : null
  const daysSinceActive = lastActiveWeek
    ? Math.floor((Date.now() - new Date(lastActiveWeek).getTime()) / 86_400_000)
    : 999

  // Archetype
  const tooCleanScore = computeTooCleanScore(cs, sp)
  const archetype = detectArchetype(overallFirstPass, bruteForceCount, totalQs, daysSinceActive, codingCourseNames.length, tooCleanScore)

  // Cohort percentiles
  const firstPassPercentile = percentile(overallFirstPass, cohort.overallFirstPassRates)
  const bfPercentile = percentile(bruteForceCount, cohort.bruteForceCountsPerLearner)
  const activityPercentile = percentile(totalQs, cohort.totalQuestionsPerLearner)

  // Feedback themes
  const themes = extractFeedbackThemes(fb)

  // Weakest areas (< 60% first pass, subjective only)
  const weakest = wa.filter((w) => n(w.first_pass_rate) < 60).slice(0, 6)

  // Top brute-force examples
  const bfExamples = sp.filter(isBruteForce).sort((a, b) => n(b.total_attempts) - n(a.total_attempts)).slice(0, 5)

  // ── Key Finding ─────────────────────────────────────────────────────────────
  lines.push('## Key Finding')

  if (archetype === 'ghoster') {
    lines.push(`**${name} has been inactive for ${daysSinceActive} days.** Last activity was ${lastActiveWeek}. Before going silent, their first-attempt pass rate was ${overallFirstPass}% (${ordinal(firstPassPercentile)} percentile in the cohort). Immediate follow-up needed.`)
  } else if (archetype === 'grinder') {
    lines.push(`**${name} completes work by brute-forcing — retrying until passing without learning from feedback.** ${bruteForceCount} questions show the pattern of repeated low scores followed by a sudden jump to full marks. This is in the ${ordinal(100 - bfPercentile)} percentile for brute-force behavior in the cohort. First-attempt pass rate is ${overallFirstPass}%, which is misleading because it's inflated by easy questions.`)
  } else if (archetype === 'skimmer') {
    lines.push(`**${name} has limited engagement — only ${totalQs} questions attempted across ${codingCourseNames.length || 'few'} coding course(s).** This puts them in the ${ordinal(activityPercentile)} percentile for activity. The coverage is too thin to build interview-ready skills.`)
  } else if (archetype === 'struggler') {
    lines.push(`**${name} is struggling fundamentally — ${overallFirstPass}% first-attempt pass rate, which is in the ${ordinal(firstPassPercentile)} percentile of the cohort.** This isn't a retry or effort problem — the concepts aren't landing on first exposure. Needs targeted support on foundations.`)
  } else if (archetype === 'too-clean') {
    const retryRatio = totalQs > 0 ? (totalRetries / totalQs).toFixed(2) : '0'
    lines.push(`**${name}'s performance looks suspiciously clean.** ${overallFirstPass}% first-attempt pass rate (${ordinal(firstPassPercentile)} percentile) with a retry ratio of only ${retryRatio}× — very few retries for this volume of work. Most questions are passed on the first attempt with full marks. This pattern is consistent with looking up answers before submitting or getting external help. If interview performance doesn't match these scores, the gap confirms the concern.`)
  } else if (archetype === 'needs-improvement') {
    lines.push(`**${name} is below the cohort average** with a ${overallFirstPass}% first-attempt pass rate (${ordinal(firstPassPercentile)} percentile). ${bruteForceCount > 0 ? 'There are ' + bruteForceCount + ' questions with brute-force retry patterns.' : 'Effort is visible but concepts aren\'t consistently landing.'} Targeted support on weak areas could help close the gap.`)
  } else {
    const bfNote = bruteForceCount > 5
      ? ` ${bruteForceCount} questions show retry patterns worth monitoring, but they represent a small fraction of ${totalQs} total questions.`
      : bruteForceCount > 0
      ? ` Minor retry patterns on ${bruteForceCount} questions — not a concern at this scale.`
      : ' No significant brute-force patterns detected.'
    lines.push(`**${name} is performing steadily** with a ${overallFirstPass}% first-attempt pass rate (${ordinal(firstPassPercentile)} percentile).${bfNote}`)
  }
  lines.push('')

  // ── Evidence ────────────────────────────────────────────────────────────────
  lines.push('## Evidence')

  // Per-course performance
  for (const courseName of codingCourseNames) {
    const subj = codingCourses.find((c) => c.course_name === courseName && c.question_type === 'subjective')
    if (!subj) continue
    const fpr = n(subj.first_attempt_pass_rate)
    const score = n(subj.avg_first_score)
    const retries = n(subj.retries)
    const qs = n(subj.distinct_questions)

    // Cohort comparison
    const key = courseName + '|subjective'
    const cohortRates = cohort.firstPassRates.get(key) ?? []
    const coursePercentile = cohortRates.length > 0 ? percentile(fpr, cohortRates) : null
    const comparison = coursePercentile !== null ? ` (${ordinal(coursePercentile)} percentile in cohort)` : ''

    lines.push(`- **${courseName}**: ${fpr}% first-attempt pass${comparison}, avg first score ${score}%, ${retries} retries across ${qs} questions`)
  }

  if (daysSinceActive < 999) {
    lines.push(`- **Activity**: ${weeks.length} active weeks, last active ${daysSinceActive} day${daysSinceActive !== 1 ? 's' : ''} ago, avg ${Math.round(at.reduce((s, a) => s + n(a.attempts), 0) / (weeks.length || 1))} attempts/week`)
  }

  if (bruteForceCount > 0) {
    lines.push(`- **Feedback incorporation issues**: ${bruteForceCount} questions where the learner was stuck at the same score for multiple attempts before a sudden breakthrough — suggests difficulty incorporating AI feedback. View the conversations for these questions to understand what specifically was blocking them.`)
    for (const p of bfExamples) {
      lines.push(`  - ${p.course_name} → ${p.question_title}: \`${p.score_progression}\``)
    }
  }
  lines.push('')

  // ── Comparison to Cohort ────────────────────────────────────────────────────
  lines.push('## Comparison to Cohort')
  const cohortAvgFirstPass = cohort.overallFirstPassRates.length > 0
    ? Math.round(cohort.overallFirstPassRates.reduce((a, b) => a + b, 0) / cohort.overallFirstPassRates.length)
    : 0
  const diff = overallFirstPass - cohortAvgFirstPass

  lines.push(`- Overall first-attempt pass rate: **${overallFirstPass}%** vs cohort average **${cohortAvgFirstPass}%** (${diff >= 0 ? '+' : ''}${diff}pp)`)
  lines.push(`- Percentile rank: **${ordinal(firstPassPercentile)}** out of ${cohort.overallFirstPassRates.length} learners`)
  lines.push(`- Activity level: **${ordinal(activityPercentile)}** percentile (${totalQs} questions attempted)`)
  if (bruteForceCount > 0) {
    lines.push(`- Brute-force frequency: **${ordinal(100 - bfPercentile)}** percentile (${bruteForceCount} questions — higher = more brute-forcing)`)
  }
  lines.push('')

  // ── Specific Gaps ───────────────────────────────────────────────────────────
  if (weakest.length > 0 || themes.length > 0) {
    lines.push('## Specific Gaps')

    if (weakest.length > 0) {
      lines.push('**Weakest topics** (below 60% first-attempt pass):')
      for (const w of weakest) {
        lines.push(`- ${w.course_name} → **${w.milestone_name}**: ${w.first_pass_rate}% first pass (${w.questions} questions)`)
      }
    }

    if (themes.length > 0) {
      lines.push('')
      lines.push('**Recurring mistake types** (from AI feedback):')
      for (const t of themes.slice(0, 5)) {
        lines.push(`- **${t.theme}**: ${t.count} instances (${t.pct}% of failures)`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { data: learners, error } = await supabase
    .from('learner_analysis')
    .select('learner_id, email, raw_data')

  if (error) throw new Error(error.message)
  if (!learners || learners.length === 0) { console.log('No learners found'); return }

  // Get names
  const emails = learners.map((l) => l.email)
  const { data: users } = await supabase.from('users').select('email, name').in('email', emails)
  const nameMap = new Map((users ?? []).map((u) => [u.email, u.name ?? u.email]))

  // Build cohort stats
  console.log('[write-analysis] Building cohort stats across ' + learners.length + ' learners...')
  const allRaw = learners.map((l) => ({ email: l.email, raw: l.raw_data as RawData }))
  const cohort = buildCohortStats(allRaw)
  console.log('[write-analysis] Cohort avg first-pass rate: ' +
    Math.round(cohort.overallFirstPassRates.reduce((a, b) => a + b, 0) / cohort.overallFirstPassRates.length) + '%')

  // Write analysis per learner
  console.log('[write-analysis] Writing analysis for ' + learners.length + ' learners...')

  let count = 0
  for (const learner of learners) {
    const name = nameMap.get(learner.email) ?? learner.email
    const analysis = writeAnalysis(name, learner.raw_data as RawData, cohort)

    const { error: updateErr } = await supabase
      .from('learner_analysis')
      .update({
        analysis_text: analysis,
        updated_at: new Date().toISOString(),
      })
      .eq('learner_id', learner.learner_id)

    if (updateErr) {
      console.error('  FAILED for ' + name + ': ' + updateErr.message)
    } else {
      count++
      process.stdout.write('.')
    }
  }

  console.log('\n[write-analysis] Done. Wrote analysis for ' + count + '/' + learners.length + ' learners.')
}

main().catch((e) => { console.error(e); process.exit(1) })
