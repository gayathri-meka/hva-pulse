/**
 * Ask Pulse eval runner.
 *
 * Runs each case in golden-set.json through the full pipeline:
 *   OpenAI tool-call loop → Supabase queries → final answer
 *
 * Scores:
 *   - tool_recall:   fraction of expected_tools that were actually called
 *   - mentions:      fraction of must_mention strings present in the answer
 *   - pass:          true if both are 1.0
 *
 * Usage:
 *   OPENAI_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx ask-pulse-evals/run-evals.ts
 *
 * Or add a .env file at the repo root and the script will load it automatically.
 */

import 'dotenv/config'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import type { ChatCompletionMessageParam } from 'openai/resources/chat'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { SYSTEM_PROMPT } from '../lib/ask-pulse/system-prompt'
import { TOOLS, type ToolName } from '../lib/ask-pulse/tools'
import { executeToolCall } from '../lib/ask-pulse/tool-handlers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoldenCase {
  id: string
  query: string
  expected_tools: string[]
  must_mention: string[]
}

interface EvalResult {
  id: string
  query: string
  tools_called: string[]
  answer: string
  tool_recall: number
  mentions_score: number
  pass: boolean
  error?: string
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY // service role to bypass RLS
const OPENAI_KEY = process.env.OPENAI_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error(
    'Missing env vars. Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY',
  )
  process.exit(1)
}

const openai = new OpenAI({ apiKey: OPENAI_KEY })
// Service role key: bypasses RLS so evals can run without a user session.
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const MAX_ROUNDS = 5

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runCase(c: GoldenCase): Promise<EvalResult> {
  const toolsCalled: string[] = []
  let answer = ''

  try {
    const thread: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: c.query },
    ]

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: thread,
        tools: TOOLS,
        tool_choice: 'auto',
      })

      const choice = response.choices[0]
      thread.push(choice.message as ChatCompletionMessageParam)

      if (choice.finish_reason !== 'tool_calls') {
        answer = choice.message.content ?? ''
        break
      }

      const tcs = (choice.message.tool_calls ?? []).filter((tc) => tc.type === 'function')
      const results = await Promise.all(
        tcs.map(async (tc) => {
          const fn = (tc as { id: string; type: 'function'; function: { name: string; arguments: string } }).function
          toolsCalled.push(fn.name)
          let result: unknown
          try {
            const args = JSON.parse(fn.arguments) as Record<string, unknown>
            result = await executeToolCall(fn.name as ToolName, args, supabase)
          } catch (err) {
            result = { error: String(err) }
          }
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          }
        }),
      )
      thread.push(...results)
    }
  } catch (err) {
    return {
      id: c.id,
      query: c.query,
      tools_called: toolsCalled,
      answer,
      tool_recall: 0,
      mentions_score: 0,
      pass: false,
      error: String(err),
    }
  }

  // Score
  const uniqueToolsCalled = new Set(toolsCalled)
  const tool_recall =
    c.expected_tools.length === 0
      ? 1
      : c.expected_tools.filter((t) => uniqueToolsCalled.has(t)).length / c.expected_tools.length

  const answerLower = answer.toLowerCase()
  const mentions_score =
    c.must_mention.length === 0
      ? 1
      : c.must_mention.filter((m) => answerLower.includes(m.toLowerCase())).length /
        c.must_mention.length

  const pass = tool_recall === 1 && mentions_score === 1

  return { id: c.id, query: c.query, tools_called: toolsCalled, answer, tool_recall, mentions_score, pass }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const goldenSetPath = resolve(__dirname, 'golden-set.json')
  const cases: GoldenCase[] = JSON.parse(readFileSync(goldenSetPath, 'utf-8'))

  console.log(`\nRunning ${cases.length} eval cases against gpt-4o + Supabase...\n`)

  const results: EvalResult[] = []
  for (const c of cases) {
    process.stdout.write(`  ${c.id.padEnd(32)} `)
    const result = await runCase(c)
    results.push(result)
    const status = result.pass ? '✓ PASS' : result.error ? '✗ ERROR' : '✗ FAIL'
    const details = result.error
      ? result.error.slice(0, 60)
      : `tools=${result.tool_recall.toFixed(2)} mentions=${result.mentions_score.toFixed(2)} [${result.tools_called.join(', ')}]`
    console.log(`${status}  ${details}`)
  }

  const passed = results.filter((r) => r.pass).length
  const total = results.length
  console.log(`\n${'─'.repeat(72)}`)
  console.log(`Results: ${passed}/${total} passed (${Math.round((passed / total) * 100)}%)\n`)

  if (passed < total) {
    console.log('Failed cases:')
    for (const r of results.filter((r) => !r.pass)) {
      console.log(`\n  [${r.id}]`)
      console.log(`  Query:        ${r.query}`)
      console.log(`  Tools called: ${r.tools_called.join(', ') || '(none)'}`)
      if (r.error) console.log(`  Error:        ${r.error}`)
      console.log(`  Answer:       ${r.answer.slice(0, 200)}${r.answer.length > 200 ? '…' : ''}`)
    }
    console.log()
  }

  process.exit(passed === total ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
