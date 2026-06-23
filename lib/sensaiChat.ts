// Shared helpers for turning sensai `chat_history` rows into structured chat
// messages. The same content shape is surfaced in the Learning deep-dive and the
// Admissions → Challenge drill-downs, so the parsing lives here once.
//
// `chat_history.content` is JSON written by the AI grader:
//   - Subjective: { feedback, scorecard: [{ score, max_score, pass_score,
//                   feedback: { correct, wrong } }] }
//   - Objective:  { feedback, is_correct: bool }
// User rows carry the raw answer (code / text) as plain `content`.

export type ChatMessage = {
  role: 'user' | 'assistant'
  /** Assistant: grader feedback text. User: the raw answer/code they submitted. */
  content: string
  /** Display score: "x/y" (subjective) or "Correct"/"Wrong" (objective), else null. */
  score: string | null
  /** Passed? score >= pass_score (subjective) or is_correct (objective). null if unknown. */
  correct: boolean | null
  feedback_correct: string | null
  feedback_wrong: string | null
  /** ISO timestamp, or '' if unparseable. */
  timestamp: string
}

// BigQuery TIMESTAMPs arrive as epoch-seconds strings in scientific notation
// (e.g. "1.782149098353E9"). Tolerate ISO strings / numbers too. → ISO or null.
export function sensaiTsToIso(v: unknown): string | null {
  if (v == null || v === '') return null
  let ms: number | null = null
  if (typeof v === 'number') ms = v < 1e12 ? v * 1000 : v
  else if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) ms = n < 1e12 ? n * 1000 : n
    else {
      const parsed = Date.parse(v)
      if (!Number.isNaN(parsed)) return new Date(parsed).toISOString()
    }
  }
  if (ms == null || !Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

type ParsedAssistant = {
  text: string
  score: string | null
  correct: boolean | null
  feedback_correct: string | null
  feedback_wrong: string | null
}

/** Parse an assistant grader payload (subjective scorecard OR objective is_correct). */
export function parseAssistantContent(raw: string): ParsedAssistant {
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { text: raw, score: null, correct: null, feedback_correct: null, feedback_wrong: null }
  }

  const text = (parsed.feedback as string) ?? raw
  const sc = (parsed.scorecard as Array<Record<string, unknown>> | undefined)?.[0]

  if (sc) {
    const score = sc.score != null && sc.max_score != null ? `${sc.score}/${sc.max_score}` : null
    const correct =
      sc.score != null && sc.pass_score != null ? Number(sc.score) >= Number(sc.pass_score) : null
    const fb = sc.feedback as { correct?: string | null; wrong?: string | null } | undefined
    return {
      text,
      score,
      correct,
      feedback_correct: fb?.correct ?? null,
      feedback_wrong: fb?.wrong ?? null,
    }
  }

  if (typeof parsed.is_correct === 'boolean') {
    return {
      text,
      score: parsed.is_correct ? 'Correct' : 'Wrong',
      correct: parsed.is_correct,
      feedback_correct: parsed.is_correct ? text : null,
      feedback_wrong: parsed.is_correct ? null : text,
    }
  }

  // Bare top-level score, no scorecard wrapper.
  if (parsed.score != null) {
    return {
      text,
      score: parsed.max_score != null ? `${parsed.score}/${parsed.max_score}` : String(parsed.score),
      correct: null,
      feedback_correct: null,
      feedback_wrong: null,
    }
  }

  return { text, score: null, correct: null, feedback_correct: null, feedback_wrong: null }
}

/** Turn a raw (role, content, created_at) chat_history row into a ChatMessage. */
export function toChatMessage(
  role: string,
  content: string | null,
  createdAt: unknown,
): ChatMessage {
  const ts = sensaiTsToIso(createdAt) ?? ''
  if (role === 'assistant') {
    const p = parseAssistantContent(content ?? '')
    return {
      role: 'assistant',
      content: p.text,
      score: p.score,
      correct: p.correct,
      feedback_correct: p.feedback_correct,
      feedback_wrong: p.feedback_wrong,
      timestamp: ts,
    }
  }
  return {
    role: 'user',
    content: content ?? '',
    score: null,
    correct: null,
    feedback_correct: null,
    feedback_wrong: null,
    timestamp: ts,
  }
}

export type ScorecardCategory = {
  name: string
  description: string
  minScore: number | null
  maxScore: number | null
  passScore: number | null
}

// sensai stores question prompts as BlockNote JSON: an array of blocks, each with
// a `content` array of { type:'text', text } runs and optional nested `children`.
// Flatten to plain text (one line per block).
export function blocksToText(raw: string | null): string {
  if (!raw) return ''
  let blocks: unknown
  try {
    blocks = JSON.parse(raw)
  } catch {
    return ''
  }
  if (!Array.isArray(blocks)) return ''
  const lines: string[] = []
  const walk = (arr: unknown[]) => {
    for (const b of arr as Array<Record<string, unknown>>) {
      const content = b?.content
      const txt = Array.isArray(content)
        ? content.map((c) => (typeof (c as { text?: unknown })?.text === 'string' ? (c as { text: string }).text : '')).join('')
        : ''
      if (txt.trim()) lines.push(txt)
      const children = b?.children
      if (Array.isArray(children) && children.length) walk(children)
    }
  }
  walk(blocks)
  return lines.join('\n').trim()
}

/** Parse a scorecard's `criteria` JSON (array of grading categories). */
export function parseScorecardCriteria(raw: string | null): ScorecardCategory[] {
  if (!raw) return []
  let arr: unknown
  try {
    arr = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  const num = (v: unknown) => (v == null ? null : Number(v))
  return (arr as Array<Record<string, unknown>>).map((c) => ({
    name: String(c?.name ?? ''),
    description: typeof c?.description === 'string' ? c.description : '',
    minScore: num(c?.min_score),
    maxScore: num(c?.max_score),
    passScore: num(c?.pass_score),
  }))
}

/** Tailwind classes for a score badge, given a "x/y" or "Correct"/"Wrong" label. */
export function scoreBadgeClass(score: string | null, correct?: boolean | null): string {
  if (score == null) return 'bg-zinc-100 text-zinc-600'
  if (score === 'Correct' || correct === true) return 'bg-emerald-100 text-emerald-700'
  if (score === 'Wrong' || correct === false) return 'bg-red-100 text-red-700'
  const m = score.match(/^(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/)
  if (m) {
    const ratio = Number(m[2]) ? Number(m[1]) / Number(m[2]) : 0
    if (ratio >= 0.9) return 'bg-emerald-100 text-emerald-700'
    if (ratio >= 0.5) return 'bg-amber-100 text-amber-700'
    return 'bg-red-100 text-red-700'
  }
  return 'bg-zinc-100 text-zinc-600'
}
