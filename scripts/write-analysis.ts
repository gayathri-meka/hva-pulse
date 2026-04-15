/**
 * Generates analysis_text for each learner based on their stored raw_data.
 * Uses pattern-detection heuristics to surface key findings.
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

function n(v: string | null | undefined): number {
  return parseFloat(v ?? '0') || 0
}

function analyzelearner(email: string, name: string, raw: {
  course_summary: CourseSummary[]
  weakest_areas: WeakArea[]
  score_progressions: Progression[]
  feedback_samples: FeedbackSample[]
  activity_timeline: ActivityRow[]
}): string {
  const lines: string[] = []
  const cs = raw.course_summary ?? []
  const wa = raw.weakest_areas ?? []
  const sp = raw.score_progressions ?? []
  const fb = raw.feedback_samples ?? []
  const at = raw.activity_timeline ?? []

  if (cs.length === 0) {
    return 'No sensai activity data found for this learner.'
  }

  // ── Overall stats ───────────────────────────────────────────────────────────
  const totalAttempts    = cs.reduce((s, c) => s + n(c.total_attempts), 0)
  const totalQuestions   = cs.reduce((s, c) => s + n(c.distinct_questions), 0)
  const totalRetries     = cs.reduce((s, c) => s + n(c.retries), 0)
  const totalFirstPassed = cs.reduce((s, c) => s + n(c.first_attempt_passed), 0)
  const totalFirstAttempts = cs.reduce((s, c) => s + n(c.total_attempts) - n(c.retries), 0)
  const overallFirstPassRate = totalFirstAttempts > 0 ? Math.round((totalFirstPassed / totalFirstAttempts) * 100) : 0
  const retryRatio       = totalQuestions > 0 ? (totalRetries / totalQuestions).toFixed(1) : '0'

  const courses = [...new Set(cs.map((c) => c.course_name))]

  lines.push(`## Overview`)
  lines.push(`${name} has attempted ${totalQuestions} distinct questions across ${courses.length} courses (${courses.join(', ')}), with ${totalAttempts} total attempts and ${totalRetries} retries (${retryRatio}× retry ratio).`)
  lines.push(`Overall first-attempt pass rate: **${overallFirstPassRate}%**.`)
  lines.push('')

  // ── Per-course breakdown ────────────────────────────────────────────────────
  lines.push(`## Per-Course Performance`)
  const codingCourses = cs.filter((c) => ['Coding in Python', 'Web Development', 'React', 'Backend'].includes(c.course_name))
  for (const course of [...new Set(codingCourses.map((c) => c.course_name))]) {
    const subj = codingCourses.find((c) => c.course_name === course && c.question_type === 'subjective')
    const obj  = codingCourses.find((c) => c.course_name === course && c.question_type === 'objective')
    if (subj) {
      const fpr = n(subj.first_attempt_pass_rate)
      const score = n(subj.avg_first_score)
      const retries = n(subj.retries)
      const qs = n(subj.distinct_questions)
      const flag = fpr < 60 ? ' ⚠️' : fpr < 75 ? ' ⚡' : ''
      lines.push(`- **${course}** (subjective): ${fpr}% first-attempt pass, ${score}% avg first score, ${retries} retries across ${qs} questions${flag}`)
    }
    if (obj) {
      const fpr = n(obj.first_attempt_pass_rate)
      lines.push(`- **${course}** (objective): ${fpr}% first-attempt pass`)
    }
  }
  lines.push('')

  // ── Weakest areas ───────────────────────────────────────────────────────────
  const weakest = wa.filter((w) => n(w.first_pass_rate) < 60).slice(0, 8)
  if (weakest.length > 0) {
    lines.push(`## Weakest Areas (first-attempt pass rate < 60%)`)
    for (const w of weakest) {
      lines.push(`- ${w.course_name} → **${w.milestone_name}**: ${w.first_pass_rate}% first pass (${w.questions} questions, avg score ${w.avg_first_score}%)`)
    }
    lines.push('')
  }

  // ── Brute-force patterns ────────────────────────────────────────────────────
  const suspicious = sp.filter((p) => {
    const parts = (p.score_progression ?? '').split(' -> ')
    if (parts.length < 4) return false
    // Check if most early attempts are the same low score then sudden jump
    const scores = parts.map((s) => {
      const [num, den] = s.split('/')
      return den ? parseFloat(num) / parseFloat(den) : 0
    })
    const earlyScores = scores.slice(0, -1)
    const lastScore = scores[scores.length - 1]
    const avgEarly = earlyScores.reduce((a, b) => a + b, 0) / earlyScores.length
    return avgEarly < 0.5 && lastScore >= 0.9 && earlyScores.length >= 3
  })

  if (suspicious.length > 0) {
    lines.push(`## Brute-Force / Suspected Copy Patterns`)
    lines.push(`${suspicious.length} questions where score was stuck low then suddenly jumped to full marks:`)
    for (const p of suspicious.slice(0, 8)) {
      lines.push(`- ${p.course_name} → ${p.question_title}: \`${p.score_progression}\` (${p.total_attempts} attempts)`)
    }
    if (suspicious.length > 8) {
      lines.push(`- ... and ${suspicious.length - 8} more`)
    }
    lines.push('')
  }

  // ── Feedback themes ─────────────────────────────────────────────────────────
  const feedbackTexts = fb.map((f) => (f.wrong_feedback ?? '').toLowerCase())
  const themes: Record<string, number> = {}
  const keywords: [string, string][] = [
    ['edge case', 'Edge case handling'],
    ['single.element\|empty', 'Empty/single-element inputs'],
    ['negative', 'Negative number handling'],
    ['zero\|0', 'Zero handling'],
    ['logic', 'Logic errors'],
    ['condition', 'Incorrect conditions'],
    ['constraint', 'Not following constraints'],
    ['print\|output\|format', 'Output formatting'],
    ['loop', 'Loop issues'],
    ['undefined\|null\|NaN', 'Undefined/null handling'],
    ['indent', 'Indentation issues'],
  ]
  for (const [pattern, label] of keywords) {
    const regex = new RegExp(pattern, 'i')
    const count = feedbackTexts.filter((t) => regex.test(t)).length
    if (count > 0) themes[label] = count
  }

  const sortedThemes = Object.entries(themes).sort((a, b) => b[1] - a[1])
  if (sortedThemes.length > 0) {
    lines.push(`## Recurring Feedback Themes`)
    lines.push(`Based on ${fb.length} failed-attempt feedback samples:`)
    for (const [theme, count] of sortedThemes.slice(0, 6)) {
      const pct = Math.round((count / fb.length) * 100)
      lines.push(`- **${theme}**: ${count} mentions (${pct}%)`)
    }
    lines.push('')
  }

  // ── Activity pattern ────────────────────────────────────────────────────────
  if (at.length > 0) {
    const weeks = [...new Set(at.map((a) => a.week))].sort()
    const lastActiveWeek = weeks[weeks.length - 1]
    const totalWeeks = weeks.length

    // Check for recent inactivity
    const now = new Date()
    const lastActive = new Date(lastActiveWeek)
    const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))

    lines.push(`## Activity Pattern`)
    lines.push(`Active across ${totalWeeks} weeks. Last activity: ${lastActiveWeek} (${daysSinceActive} days ago).`)

    if (daysSinceActive > 14) {
      lines.push(`⚠️ **Inactive for ${daysSinceActive} days** — may need follow-up.`)
    }

    // Weekly intensity
    const weeklyAttempts = new Map<string, number>()
    for (const a of at) {
      weeklyAttempts.set(a.week, (weeklyAttempts.get(a.week) ?? 0) + n(a.attempts))
    }
    const avgWeekly = Math.round([...weeklyAttempts.values()].reduce((a, b) => a + b, 0) / weeklyAttempts.size)
    lines.push(`Average ${avgWeekly} attempts per active week.`)
    lines.push('')
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  lines.push(`## Key Takeaways`)
  const takeaways: string[] = []

  if (overallFirstPassRate < 60) {
    takeaways.push(`Low first-attempt pass rate (${overallFirstPassRate}%) suggests fundamental gaps in understanding.`)
  } else if (overallFirstPassRate < 75) {
    takeaways.push(`Moderate first-attempt pass rate (${overallFirstPassRate}%) — concepts are partially understood but application is inconsistent.`)
  }

  if (suspicious.length > 5) {
    takeaways.push(`${suspicious.length} questions show brute-force patterns (stuck at low scores then sudden jump to full marks) — possible copying or over-reliance on hints.`)
  } else if (suspicious.length > 0) {
    takeaways.push(`${suspicious.length} questions with suspicious retry patterns worth investigating.`)
  }

  if (weakest.length > 0) {
    const worstMilestones = weakest.slice(0, 3).map((w) => w.milestone_name).join(', ')
    takeaways.push(`Weakest areas: ${worstMilestones}.`)
  }

  if (sortedThemes.length > 0) {
    const topTheme = sortedThemes[0][0]
    takeaways.push(`Most common feedback issue: ${topTheme}.`)
  }

  if (takeaways.length === 0) {
    takeaways.push('Performance appears consistent — no major red flags detected from the data.')
  }

  for (const t of takeaways) {
    lines.push(`- ${t}`)
  }

  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { data: learners, error } = await supabase
    .from('learner_analysis')
    .select('learner_id, email, raw_data')

  if (error) throw new Error(error.message)
  if (!learners || learners.length === 0) { console.log('No learners found'); return }

  // Get names from users table
  const emails = learners.map((l) => l.email)
  const { data: users } = await supabase.from('users').select('email, name').in('email', emails)
  const nameMap = new Map((users ?? []).map((u) => [u.email, u.name ?? u.email]))

  console.log('[write-analysis] Processing ' + learners.length + ' learners...')

  let count = 0
  for (const learner of learners) {
    const name = nameMap.get(learner.email) ?? learner.email
    const analysis = analyzelearner(learner.email, name, learner.raw_data as any)

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
