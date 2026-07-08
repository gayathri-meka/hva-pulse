// Scorecard Studio — prompts + pure helpers for the SensAI scorecard tools.
//
// A "scorecard" is the rubric an admin uploads so SensAI's AI grades learner
// answers. A vague scorecard grades inconsistently. These tools help the team
// (a) generate a good scorecard, (b) inspect whether one is good, and (c) dry-run
// grading an answer against it.

export const DIMENSION_ORDER = [
  'Observable descriptors',
  'Explicit fail conditions',
  'Separated criteria',
  'Anchored levels',
  'Question specificity',
  'AI-scorability',
] as const

export const INSPECT_SYSTEM = `You are an expert in designing rubrics for LLM-based grading. You evaluate a "scorecard" (a rubric an admin uploads so an AI can grade learner answers). A vague scorecard makes the AI grade inconsistently. Judge the scorecard ONLY on whether an AI could apply it the same way every time.

Score each of these six dimensions as "strong", "partial", or "weak":
1. Observable descriptors — criteria use checkable language, not vague words (good, clear, strong, shows understanding).
2. Explicit fail conditions — defines what earns a zero/fail, not only what passes.
3. Separated criteria — each criterion is judged independently, not several bundled into one judgment.
4. Anchored levels — each performance level has a concrete example or anchor of what it looks like.
5. Question specificity — tied to the actual question/expected answer, not a generic template reusable anywhere.
6. AI-scorability — overall, two different AI runs would land on the same score.

Then give an overall score 0-100 and verdict: "Too vague" (0-49), "Needs tightening" (50-74), or "Ready" (75-100).

Flag up to 4 specific problems. Each must quote a short verbatim snippet FROM THE SCORECARD, name the problem, and give a concrete fix. If the scorecard is already strong, return fewer or zero issues.

Respond with ONLY valid JSON, no markdown, no preamble, in exactly this shape:
{"score": <int>, "verdict": "<string>", "summary": "<one terse sentence>", "dimensions": [{"name":"Observable descriptors","rating":"strong|partial|weak","note":"<=16 words"}, ... all six in the order listed], "issues": [{"snippet":"<verbatim from scorecard>","problem":"<=14 words","fix":"<=22 words"}]}
Keep every note and field terse.`

export const GENERATE_SYSTEM = `You write rubrics ("scorecards") for LLM-based grading of learner answers. Given a question, what the scorecard should check, and optional example answers with intended scores, produce ONE scorecard an AI can apply consistently.

You MUST follow these principles:
- Observable descriptors: no vague words (good, clear, strong, shows understanding). Use checkable language a grader can point to.
- Explicit fail condition: define exactly what earns the lowest score.
- One thing per scorecard: grade ONLY what is asked. Explicitly fence out what is out of scope (e.g. "Do not judge grammar or format") if not requested.
- Anchor every score level with a short concrete example. Use the user's examples where given; invent brief ones tied to the question otherwise.
- Make it specific to the question and its expected answer.
- Use only as many levels as can be reliably told apart with examples. If unsure, use fewer levels.

Format: start with a one-line "Check whether..." statement, then score levels from highest to lowest, each on its own line with a one-line anchor example. Return ONLY the scorecard as clean plain text. No preamble, no commentary, no markdown headers.`

export const REWRITE_SYSTEM = `You tighten rubrics so an AI grades them consistently. Rewrite the scorecard the user gives you: keep their intent, but make every descriptor observable, separate bundled criteria, add explicit fail conditions, and anchor each level with a concrete example. If a question is given, make it specific to that question. Return only the rewritten scorecard as clean plain text. No preamble, no commentary.`

// PLACEHOLDER grading prompt — an approximation of SensAI's grader, NOT the
// production prompt. Swap in the real SensAI system prompt when available so the
// Test tab mirrors production grading exactly.
export const TEST_SYSTEM = `You are an AI grader inside a learning platform. Apply the given scorecard to the learner's response exactly as written. Grade ONLY what the scorecard tells you to grade. Use the question (and expected answer, if implied) as context. Be strict and literal about the scorecard's levels.

Respond with ONLY valid JSON, no markdown: {"score": "<the score value from the scorecard's own scale, e.g. 4>", "scale": "<the scale, e.g. 1-4>", "feedback": "<=40 words of feedback to the learner>", "reasoning": "<=28 words naming which scorecard level you applied and why>"}`

export const TEST_PROMPT_IS_PLACEHOLDER = true

export type DimensionRating = 'strong' | 'partial' | 'weak'
export type InspectResult = {
  score: number
  verdict: string
  summary: string
  dimensions: { name: string; rating: DimensionRating; note: string }[]
  issues: { snippet: string; problem: string; fix: string }[]
}
export type TestRun = { score: string; scale: string; feedback: string; reasoning: string }

// Extract the first JSON object from a model response (tolerates code fences +
// leading/trailing prose). Throws if none parses.
export function parseModelJSON<T = unknown>(text: string): T {
  let t = (text || '').replace(/```json|```/g, '').trim()
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a !== -1 && b !== -1) t = t.slice(a, b + 1)
  return JSON.parse(t) as T
}

// Normalise an inspect response: clamp score, force all six dimensions in order.
export function normalizeInspect(raw: Partial<InspectResult>): InspectResult {
  const byName = new Map((raw.dimensions ?? []).map((d) => [d.name, d]))
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0))),
    verdict: raw.verdict || 'Needs tightening',
    summary: raw.summary || '',
    dimensions: DIMENSION_ORDER.map(
      (name) => byName.get(name) ?? { name, rating: 'partial' as DimensionRating, note: '' },
    ),
    issues: Array.isArray(raw.issues) ? raw.issues.slice(0, 4) : [],
  }
}

export function verdictFor(score: number): string {
  return score >= 75 ? 'Ready' : score >= 50 ? 'Needs tightening' : 'Too vague'
}
