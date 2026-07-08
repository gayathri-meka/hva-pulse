'use server'

import Anthropic from '@anthropic-ai/sdk'
import { requireStaff } from '@/lib/auth'
import {
  INSPECT_SYSTEM,
  GENERATE_SYSTEM,
  REWRITE_SYSTEM,
  TEST_SYSTEM,
  parseModelJSON,
  normalizeInspect,
  type InspectResult,
  type TestRun,
} from '@/lib/tools/scorecard'

const MODEL = 'claude-sonnet-4-6'

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }

async function callClaude(system: string, user: string, maxTokens = 1200): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not configured.')
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

/** (b) Evaluate whether a scorecard is "good" — AI-gradeable + consistent. */
export async function inspectScorecard(input: {
  question: string
  scorecard: string
}): Promise<Ok<InspectResult> | Err> {
  await requireStaff()
  const scorecard = input.scorecard?.trim()
  if (!scorecard) return { ok: false, error: 'Paste a scorecard to inspect.' }
  const question = input.question?.trim()
  const user = (question ? `QUESTION THIS SCORECARD GRADES:\n${question}\n\n` : '') + `SCORECARD:\n${scorecard}`
  try {
    return { ok: true, data: normalizeInspect(parseModelJSON(await callClaude(INSPECT_SYSTEM, user))) }
  } catch {
    return { ok: false, error: "Couldn't read the evaluation. Try again, or shorten the scorecard." }
  }
}

/** Tighten an existing scorecard while keeping the author's intent. */
export async function rewriteScorecard(input: {
  question: string
  scorecard: string
}): Promise<Ok<string> | Err> {
  await requireStaff()
  const scorecard = input.scorecard?.trim()
  if (!scorecard) return { ok: false, error: 'Paste a scorecard to rewrite.' }
  const question = input.question?.trim()
  const user = (question ? `QUESTION:\n${question}\n\n` : '') + `SCORECARD TO TIGHTEN:\n${scorecard}`
  try {
    return { ok: true, data: (await callClaude(REWRITE_SYSTEM, user)).trim() }
  } catch {
    return { ok: false, error: "Couldn't generate a rewrite. Try again." }
  }
}

/** (a) Create a "good" scorecard from a question + grading intent + examples. */
export async function generateScorecard(input: {
  question: string
  expectation: string
  examples: string
}): Promise<Ok<string> | Err> {
  await requireStaff()
  const question = input.question?.trim()
  const expectation = input.expectation?.trim()
  if (!question || !expectation) return { ok: false, error: 'Add a question and what the scorecard should check.' }
  const user =
    `QUESTION:\n${question}\n\nWHAT THIS SCORECARD SHOULD CHECK:\n${expectation}` +
    (input.examples?.trim() ? `\n\nEXAMPLE ANSWERS AND INTENDED SCORES (use these as anchors):\n${input.examples.trim()}` : '')
  try {
    return { ok: true, data: (await callClaude(GENERATE_SYSTEM, user)).trim() }
  } catch {
    return { ok: false, error: "Couldn't generate a scorecard. Try again, or trim the inputs." }
  }
}

/** (c) Dry-run grading: given question + scorecard + answer, what score/feedback.
 * Runs three times so the team can see whether the score is stable. */
export async function testScorecard(input: {
  question: string
  scorecard: string
  answer: string
}): Promise<Ok<TestRun[]> | Err> {
  await requireStaff()
  const scorecard = input.scorecard?.trim()
  const answer = input.answer?.trim()
  if (!scorecard || !answer) return { ok: false, error: 'Add a scorecard and a sample answer.' }
  const question = input.question?.trim()
  const user =
    (question ? `QUESTION:\n${question}\n\n` : '') +
    `SCORECARD:\n${scorecard}\n\nLEARNER RESPONSE TO GRADE:\n${answer}`
  try {
    const runs = await Promise.all(
      [0, 1, 2].map(async () => {
        const parsed = parseModelJSON<Partial<TestRun>>(await callClaude(TEST_SYSTEM, user, 600))
        return {
          score: String(parsed.score ?? '?').trim(),
          scale: parsed.scale || '',
          feedback: parsed.feedback || '',
          reasoning: parsed.reasoning || '',
        }
      }),
    )
    return { ok: true, data: runs }
  } catch {
    return { ok: false, error: "Couldn't run the test. Try again, or shorten the inputs." }
  }
}
