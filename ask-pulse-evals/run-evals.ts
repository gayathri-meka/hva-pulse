/**
 * Ask Pulse LLM-as-a-judge eval runner.
 *
 * For each case in golden-set.json:
 *   1. Run the question through the full Ask Pulse pipeline
 *      (MCP subprocess → Anthropic claude-sonnet-4-6 agentic loop)
 *   2. Send the question + answer to GPT-4o as a judge, scored against a rubric
 *   3. Write results to ask-pulse-evals/scores/latest.json
 *
 * Usage:
 *   npx tsx ask-pulse-evals/run-evals.ts
 *   (or: npm run eval from the repo root)
 *
 * Required env vars (loaded from .env.local at repo root):
 *   ANTHROPIC_API_KEY, OPENAI_API_KEY, MCP_DATABASE_URL
 */

import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SYSTEM_PROMPT } from '../lib/ask-pulse/system-prompt.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'pipeline_stats' | 'rejection_analysis' | 'learner_specific' | 'alumni' | 'multi_join' | 'edge_case'

interface GoldenCase {
  id: string
  category: Category
  question: string
  eval_notes: string
}

interface CriterionScore {
  score: number  // 1–5
  reason: string
}

interface JudgeScores {
  answered_question: CriterionScore
  used_real_data: CriterionScore
  concise_and_readable: CriterionScore
  handled_correctly: CriterionScore
}

interface CaseResult {
  id: string
  category: Category
  question: string
  answer: string
  tools_called: string[]
  scores: JudgeScores
  mean_score: number
  error?: string
}

interface ScoreReport {
  run_at: string
  pipeline_model: string
  judge_model: string
  summary: {
    total_cases: number
    mean_score: number
    by_criterion: Record<string, number>
    by_category: Record<string, number>
  }
  cases: CaseResult[]
}

// ─── Setup ────────────────────────────────────────────────────────────────────

// Load .env.local (dotenv/config loads .env; we need .env.local)
try {
  const envLocal = readFileSync(join(ROOT, '.env.local'), 'utf-8')
  for (const line of envLocal.split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/)
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim()
    }
  }
} catch { /* .env.local not found — rely on process.env */ }

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY
const MCP_DB_URL = process.env.MCP_DATABASE_URL

if (!ANTHROPIC_KEY || !OPENAI_KEY || !MCP_DB_URL) {
  console.error('Missing required env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, MCP_DATABASE_URL')
  process.exit(1)
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })
const openai = new OpenAI({ apiKey: OPENAI_KEY })
const MAX_ROUNDS = 10
const PIPELINE_MODEL = 'claude-sonnet-4-6'
const JUDGE_MODEL = 'gpt-4o'

// ─── Ask Pulse pipeline ───────────────────────────────────────────────────────

async function runPipeline(
  question: string,
  mcp: Client,
  anthropicTools: Anthropic.Tool[],
): Promise<{ answer: string; toolsCalled: string[] }> {
  const thread: Anthropic.MessageParam[] = [{ role: 'user', content: question }]
  const toolsCalled: string[] = []

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: PIPELINE_MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: thread,
      tools: anthropicTools,
    })

    thread.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') {
      const answer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      return { answer, toolsCalled }
    }

    const toolBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    const toolResults = await Promise.all(
      toolBlocks.map(async (block) => {
        toolsCalled.push(block.name)
        let resultText: string
        try {
          const result = await mcp.callTool({
            name: block.name,
            arguments: block.input as Record<string, unknown>,
          })
          resultText = (result.content as { type: string; text: string }[])
            .filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('')
        } catch (err) {
          resultText = `Error: ${String(err)}`
        }
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: resultText,
        }
      }),
    )

    thread.push({ role: 'user', content: toolResults })
  }

  return { answer: 'Max rounds reached without a final response.', toolsCalled }
}

// ─── LLM judge ───────────────────────────────────────────────────────────────

const JUDGE_SYSTEM = `\
You are a strict evaluator for an AI assistant that queries a placement database.
Score the response on four criteria. Be honest and critical — reserve 5 for exceptional responses.

Scoring guide:
  1 = Completely failed this criterion
  2 = Poor — major issues
  3 = Acceptable — meets minimum bar with noticeable flaws
  4 = Good — minor issues only
  5 = Excellent — nothing to fault

Respond ONLY with a valid JSON object, no explanation outside it.`

async function judgeResponse(
  question: string,
  answer: string,
  category: Category,
  evalNotes: string,
): Promise<JudgeScores> {
  const userPrompt = `\
Question: ${question}

Category: ${category}

Evaluator notes (what a correct response should do):
${evalNotes}

Response to evaluate:
${answer}

Score each criterion 1–5 with a brief reason:

{
  "answered_question": {
    "score": <1-5>,
    "reason": "<did it directly answer what was asked?>"
  },
  "used_real_data": {
    "score": <1-5>,
    "reason": "<does it cite specific numbers/names from the DB, not vague claims?>"
  },
  "concise_and_readable": {
    "score": <1-5>,
    "reason": "<is it well-structured and appropriately brief — not a wall of text?>"
  },
  "handled_correctly": {
    "score": <1-5>,
    "reason": "<for edge_case category: did it handle empty/null/missing data gracefully and honestly? for others: was the logic, interpretation, and SQL reasoning sound?>"
  }
}`

  const response = await openai.chat.completions.create({
    model: JUDGE_MODEL,
    messages: [
      { role: 'system', content: JUDGE_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0,
  })

  return JSON.parse(response.choices[0].message.content ?? '{}') as JudgeScores
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Optional: --filter id1,id2,... to run a subset of cases
  const filterArg = process.argv.find((a) => a.startsWith('--filter='))
  const filterIds = filterArg ? new Set(filterArg.replace('--filter=', '').split(',')) : null

  let goldenSet: GoldenCase[] = JSON.parse(
    readFileSync(join(__dirname, 'golden-set.json'), 'utf-8'),
  )
  if (filterIds) goldenSet = goldenSet.filter((c) => filterIds.has(c.id))

  console.log(`\nAsk Pulse Eval — ${goldenSet.length} cases`)
  console.log(`Pipeline: ${PIPELINE_MODEL}   Judge: ${JUDGE_MODEL}\n`)

  // Spawn MCP server once and reuse across all cases
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'mcp/dist/server.js')],
    env: Object.fromEntries(
      Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined),
    ),
  })
  const mcp = new Client({ name: 'pulse-eval', version: '1.0.0' })
  await mcp.connect(transport)

  const { tools: mcpTools } = await mcp.listTools()
  const anthropicTools: Anthropic.Tool[] = mcpTools.map((t) => ({
    name: t.name,
    description: t.description ?? '',
    input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
  }))

  const results: CaseResult[] = []

  for (const c of goldenSet) {
    process.stdout.write(`  ${c.id.padEnd(36)} `)

    let caseResult: CaseResult

    try {
      // 1. Run through Ask Pulse pipeline
      const { answer, toolsCalled } = await runPipeline(c.question, mcp, anthropicTools)

      // 2. Judge the response
      const scores = await judgeResponse(c.question, answer, c.category, c.eval_notes)

      const criterion_scores = [
        scores.answered_question?.score ?? 0,
        scores.used_real_data?.score ?? 0,
        scores.concise_and_readable?.score ?? 0,
        scores.handled_correctly?.score ?? 0,
      ]
      const mean_score = criterion_scores.reduce((a, b) => a + b, 0) / criterion_scores.length

      caseResult = { id: c.id, category: c.category, question: c.question, answer, tools_called: toolsCalled, scores, mean_score }
    } catch (err) {
      caseResult = {
        id: c.id,
        category: c.category,
        question: c.question,
        answer: '',
        tools_called: [],
        scores: {
          answered_question: { score: 0, reason: 'Error' },
          used_real_data: { score: 0, reason: 'Error' },
          concise_and_readable: { score: 0, reason: 'Error' },
          handled_correctly: { score: 0, reason: 'Error' },
        },
        mean_score: 0,
        error: String(err),
      }
    }

    results.push(caseResult)

    const star = caseResult.mean_score >= 4 ? '★' : caseResult.mean_score >= 3 ? '◆' : '✗'
    const detail = caseResult.error
      ? `ERROR: ${caseResult.error.slice(0, 50)}`
      : `${caseResult.mean_score.toFixed(2)}/5  tools=[${caseResult.tools_called.join(', ')}]`
    console.log(`${star} ${detail}`)
  }

  await mcp.close()

  // ── Aggregate ──────────────────────────────────────────────────────────────
  const overall_mean =
    results.reduce((a, r) => a + r.mean_score, 0) / results.length

  const criterionKeys = ['answered_question', 'used_real_data', 'concise_and_readable', 'handled_correctly'] as const
  const by_criterion: Record<string, number> = {}
  for (const key of criterionKeys) {
    const scores = results.map((r) => r.scores[key]?.score ?? 0)
    by_criterion[key] = scores.reduce((a, b) => a + b, 0) / scores.length
  }

  const categories = [...new Set(results.map((r) => r.category))]
  const by_category: Record<string, number> = {}
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat)
    by_category[cat] = catResults.reduce((a, r) => a + r.mean_score, 0) / catResults.length
  }

  const report: ScoreReport = {
    run_at: new Date().toISOString(),
    pipeline_model: PIPELINE_MODEL,
    judge_model: JUDGE_MODEL,
    summary: {
      total_cases: results.length,
      mean_score: parseFloat(overall_mean.toFixed(2)),
      by_criterion: Object.fromEntries(
        Object.entries(by_criterion).map(([k, v]) => [k, parseFloat(v.toFixed(2))]),
      ),
      by_category: Object.fromEntries(
        Object.entries(by_category).map(([k, v]) => [k, parseFloat(v.toFixed(2))]),
      ),
    },
    cases: results,
  }

  // ── Write scores ───────────────────────────────────────────────────────────
  const scoresDir = join(__dirname, 'scores')
  mkdirSync(scoresDir, { recursive: true })
  writeFileSync(join(scoresDir, 'latest.json'), JSON.stringify(report, null, 2))

  // Timestamped copy for history
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  writeFileSync(join(scoresDir, `${ts}.json`), JSON.stringify(report, null, 2))

  // ── Console summary ────────────────────────────────────────────────────────
  const bar = '─'.repeat(60)
  console.log(`\n${bar}`)
  console.log(`Overall mean score: ${overall_mean.toFixed(2)} / 5.00`)
  console.log(`\nBy criterion:`)
  for (const [k, v] of Object.entries(by_criterion)) {
    const filled = Math.round(v)
    const bar_str = '█'.repeat(filled) + '░'.repeat(5 - filled)
    console.log(`  ${k.padEnd(24)} ${bar_str}  ${v.toFixed(2)}`)
  }
  console.log(`\nBy category:`)
  for (const [k, v] of Object.entries(by_category)) {
    console.log(`  ${k.padEnd(24)} ${v.toFixed(2)}`)
  }

  const weak = results.filter((r) => r.mean_score < 3)
  if (weak.length > 0) {
    console.log(`\nNeeds attention (score < 3):`)
    for (const r of weak) {
      console.log(`  [${r.id}]  ${r.mean_score.toFixed(2)}`)
      if (r.error) console.log(`    error: ${r.error}`)
    }
  }

  console.log(`\nReport written to ask-pulse-evals/scores/latest.json\n`)

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
