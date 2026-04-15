/**
 * LLM-powered learner analysis.
 *
 * For each learner:
 * 1. Pulls their top 10 most-retried conversation threads from BQ
 * 2. Feeds all threads to Claude with an analysis prompt
 * 3. Stores Claude's analysis as analysis_text in learner_analysis
 *
 * Usage: npx tsx scripts/run-llm-analysis.ts [--dry-run] [--learner email@example.com]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { runBigQuery } from '../lib/bigquery'

const supabase   = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const BQ_BILLING = 'hyperverge-chabtbot'
const BQ_DATA    = 'sensai-441917'

const DRY_RUN    = process.argv.includes('--dry-run')
const SINGLE     = process.argv.find((a, i) => process.argv[i - 1] === '--learner')

// ── Fetch conversation threads for a learner ─────────────────────────────────

async function fetchThreads(email: string, maxQuestions = 10): Promise<{
  questionTitle: string
  courseName: string
  messages: { role: string; content: string }[]
}[]> {
  const e = email.toLowerCase().replace(/'/g, "\\'")

  // Two-step: first get user_id + question_ids, then fetch threads
  const userQ = `
    SELECT id FROM \`${BQ_DATA}.sensai_prod.users\`
    WHERE created_at >= TIMESTAMP('2020-01-01')
      AND LOWER(TRIM(email)) = '${e}'
    GROUP BY id LIMIT 1
  `
  const userRows = await runBigQuery(BQ_BILLING, userQ)
  if (userRows.length === 0) return []
  const userId = userRows[0].id

  const qidsQ = `
    SELECT
      question_id,
      COUNT(*) AS attempts,
      ANY_VALUE(question_title) AS question_title,
      ANY_VALUE(course_name) AS course_name
    FROM \`${BQ_DATA}.sensai_prod.pulse_task_question_attempts\`
    WHERE LOWER(email) = '${e}'
      AND question_type = 'subjective'
      AND course_name IN ('Coding in Python', 'Web Development', 'React', 'Backend')
    GROUP BY question_id
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC
    LIMIT ${maxQuestions}
  `
  const qidRows = await runBigQuery(BQ_BILLING, qidsQ)
  if (qidRows.length === 0) return []

  const qidList = qidRows.map((r) => r.question_id).join(',')
  const titleMap = new Map(qidRows.map((r) => [r.question_id, { title: r.question_title ?? '', course: r.course_name ?? '' }]))

  const q = `
    SELECT DISTINCT
      ch.question_id,
      ch.role,
      ch.created_at,
      ch.content
    FROM \`${BQ_DATA}.sensai_prod.chat_history\` ch
    WHERE ch.created_at >= TIMESTAMP('2024-01-01')
      AND ch.user_id = ${userId}
      AND ch.question_id IN (${qidList})
    ORDER BY ch.question_id, ch.created_at ASC
  `

  const rows = await runBigQuery(BQ_BILLING, q)

  // Group by question_id, map to title
  const grouped = new Map<string, { title: string; course: string; messages: { role: string; content: string }[] }>()
  for (const row of rows) {
    const qid = row.question_id ?? ''
    const meta = titleMap.get(qid) ?? { title: qid, course: '' }
    if (!grouped.has(qid)) {
      grouped.set(qid, { title: meta.title, course: meta.course, messages: [] })
    }
    grouped.get(qid)!.messages.push({
      role: row.role ?? 'user',
      content: (row.content ?? '').substring(0, 1500),
    })
  }

  return Array.from(grouped.values()).map((data) => ({
    questionTitle: data.title,
    courseName: data.course,
    messages: data.messages,
  }))
}

// ── Format threads for the prompt ────────────────────────────────────────────

function formatThreadsForPrompt(threads: Awaited<ReturnType<typeof fetchThreads>>): string {
  const parts: string[] = []
  for (const thread of threads) {
    parts.push(`### Question: "${thread.questionTitle}" (${thread.courseName})`)
    for (const msg of thread.messages) {
      if (msg.role === 'user') {
        parts.push(`**LEARNER SUBMISSION:**\n\`\`\`\n${msg.content}\n\`\`\``)
      } else {
        // Parse AI feedback
        try {
          const parsed = JSON.parse(msg.content)
          const sc = parsed.scorecard?.[0]
          const score = sc ? `${sc.score}/${sc.max_score}` : '?'
          parts.push(`**AI FEEDBACK (Score: ${score}):**`)
          if (parsed.feedback) parts.push(parsed.feedback)
          if (sc?.feedback?.correct) parts.push(`✅ Correct: ${sc.feedback.correct}`)
          if (sc?.feedback?.wrong) parts.push(`❌ Wrong: ${sc.feedback.wrong}`)
        } catch {
          parts.push(`**AI FEEDBACK:** ${msg.content.substring(0, 500)}`)
        }
      }
      parts.push('')
    }
    parts.push('---\n')
  }
  return parts.join('\n')
}

// ── The analysis prompt ──────────────────────────────────────────────────────

function buildPrompt(learnerName: string, threadText: string, rawStats: string): string {
  return `You are analyzing a learner's coding journey on an AI-tutored learning platform. The learner submits code, the AI grades it (1-4 scale) and gives feedback with specific suggestions. The learner can retry.

Below are ${learnerName}'s most challenging questions — the ones they retried 3+ times. For each question you'll see their code submissions and the AI's feedback in chronological order.

YOUR TASK: Write a concise, actionable analysis of how ${learnerName} responds to AI feedback. Focus on:

1. **Feedback Literacy**: When the AI points out an issue, does ${learnerName}:
   - Immediately address it in the next attempt? (good)
   - Partially address it but miss the key point? (moderate)
   - Ignore it entirely and retry the same approach? (poor)
   - Need the AI to spell out the exact fix before acting on it? (needs literal instruction)

2. **Learning Pattern**: Does their code show:
   - Gradual improvement (understanding builds across attempts)?
   - Same mistake repeated (not learning from feedback)?
   - Sudden jumps (might be looking up answers after getting stuck)?

3. **Specific Weaknesses**: What types of problems or concepts trip them up? What mistakes do they keep making across different questions?

4. **Actionable Recommendation**: One specific thing their mentor should work on with them.

Keep the analysis under 300 words. Be direct — this is for their teaching team, not the learner. Use specific examples from the conversations. Don't be generic.

Here are their basic stats for context:
${rawStats}

---

CONVERSATION THREADS:

${threadText}`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { data: learners } = await supabase
    .from('learner_analysis')
    .select('learner_id, email, raw_data')

  if (!learners || learners.length === 0) { console.log('No learners found'); return }

  const { data: users } = await supabase.from('users').select('email, name').in('email', learners.map((l) => l.email))
  const nameMap = new Map((users ?? []).map((u) => [u.email, u.name ?? u.email]))

  const targets = SINGLE
    ? learners.filter((l) => l.email === SINGLE)
    : learners

  console.log(`[llm-analysis] Processing ${targets.length} learners${DRY_RUN ? ' (DRY RUN)' : ''}...`)

  let count = 0
  for (const learner of targets) {
    const name = nameMap.get(learner.email) ?? learner.email
    process.stdout.write(`  ${name}... `)

    try {
      // 1. Fetch conversation threads from BQ
      const threads = await fetchThreads(learner.email, 10)
      if (threads.length === 0) {
        console.log('no threads, skipping')
        continue
      }

      // 2. Format for prompt
      const threadText = formatThreadsForPrompt(threads)

      // 3. Build stats context from raw_data
      const rd = learner.raw_data as any
      const cs = rd?.course_summary ?? []
      const totalQs = cs.reduce((s: number, c: any) => s + (parseFloat(c.distinct_questions) || 0), 0)
      const firstPass = cs.reduce((s: number, c: any) => s + (parseFloat(c.first_attempt_passed) || 0), 0)
      const fpr = totalQs > 0 ? Math.round((firstPass / totalQs) * 100) : 0
      const retries = cs.reduce((s: number, c: any) => s + (parseFloat(c.retries) || 0), 0)
      const rawStats = `Overall: ${totalQs} questions, ${fpr}% first-attempt pass rate, ${retries} retries, ${threads.length} questions with 3+ attempts shown below.`

      const prompt = buildPrompt(name, threadText, rawStats)

      if (DRY_RUN) {
        console.log(`${threads.length} threads, prompt: ${prompt.length} chars`)
        count++
        continue
      }

      // 4. Call Claude
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      const analysisText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')

      // 5. Store
      const { error } = await supabase
        .from('learner_analysis')
        .update({
          analysis_text: analysisText,
          updated_at: new Date().toISOString(),
        })
        .eq('learner_id', learner.learner_id)

      if (error) {
        console.log('SAVE FAILED: ' + error.message)
      } else {
        console.log('done (' + analysisText.length + ' chars)')
        count++
      }

      // Small delay to avoid rate limits
      await new Promise((r) => setTimeout(r, 1000))

    } catch (e) {
      console.log('FAILED: ' + (e as Error).message)
    }
  }

  console.log(`\n[llm-analysis] Done. Analyzed ${count}/${targets.length} learners.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
