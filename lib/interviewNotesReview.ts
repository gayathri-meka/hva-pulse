// Pure helpers for the "AI check the interview notes" feature. Everything the
// LLM sees is built here (buildNotesReviewUserPrompt) and everything it returns
// is validated/normalised here (parseNotesReview), so the server action is a
// thin I/O shell and this whole file is unit-testable without the network.

export type ReviewQuestion = {
  n: number
  section: string | null
  prompt: string
  note: string // '' when the interviewer left it blank
}

export type ReviewRubric = {
  label: string
  levels: string[] // level_1..4 descriptors ('' if not set)
  lookingFor: string[] // per-level "what we're looking for" ('' if not set)
  score: number | null // 1–4 the interviewer gave, or null
}

export type NotesReviewInput = {
  candidateName: string
  round: 1 | 2
  questions: ReviewQuestion[]
  rubrics: ReviewRubric[]
  summary: string
  recommendation: string | null
}

export type QuestionGap = {
  question: string // the question prompt (or "Qn") the gap is about
  issue: string // what's missing / thin / unclear
}

export type RatingCheck = {
  rubric: string
  givenScore: number | null
  suggestedScore: number | null // null = can't tell from the notes
  aligned: boolean // do the notes justify the given score?
  rationale: string // grounded in the rubric levels
}

export type NotesReviewResult = {
  quality: 'strong' | 'adequate' | 'thin'
  overall: string
  questionGaps: QuestionGap[]
  ratingChecks: RatingCheck[]
}

const QUALITY_VALUES: NotesReviewResult['quality'][] = ['strong', 'adequate', 'thin']

export const NOTES_REVIEW_SYSTEM = `You are a meticulous interview-notes reviewer for HyperVerge Academy (HVA) admissions. You are given the questions an interviewer asked, the notes they wrote for each, the scoring rubrics (with level-by-level descriptors), the 1–4 scores the interviewer assigned per rubric, and their overall recommendation.

Your job is quality control on the NOTES and their consistency with the SCORES. You do NOT re-interview the candidate — you only judge what the interviewer captured.

Assess three things:
1. Overall quality of the notes: are they specific and evidence-based (capturing what the candidate actually said/did), or vague, generic, one-word, or missing? Classify as "strong", "adequate", or "thin".
2. Gaps by question: list the specific questions whose notes are missing, too thin, or don't actually record the candidate's answer — and say concretely what is missing. Only include questions that genuinely have a gap. If a note is fine, do not list it.
3. Rating alignment: for EACH rubric, decide whether the notes provide evidence that justifies the score the interviewer gave, using the rubric's own level descriptors as the yardstick. If the evidence points to a different level, set aligned=false and suggest the score the notes actually support, with a short rationale that cites the relevant rubric level. If the notes are too thin to judge the rubric at all, set aligned=false, suggestedScore=null, and say the notes don't support any score.

Be direct and specific. Reference the candidate's actual notes. Do not invent evidence that isn't in the notes.

Return ONLY a JSON object of exactly this shape:
{
  "quality": "strong" | "adequate" | "thin",
  "overall": "2-4 sentence overall assessment of the notes",
  "questionGaps": [ { "question": "the question prompt", "issue": "what is missing or thin" } ],
  "ratingChecks": [ { "rubric": "rubric label", "givenScore": number|null, "suggestedScore": number|null, "aligned": true|false, "rationale": "why, citing the rubric level" } ]
}`

function rubricBlock(r: ReviewRubric): string {
  const levels = r.levels
    .map((lv, i) => {
      const lf = r.lookingFor[i]?.trim()
      const base = `  ${i + 1}: ${lv?.trim() || '(no descriptor)'}`
      return lf ? `${base}\n     Looking for: ${lf}` : base
    })
    .join('\n')
  const given = r.score == null ? 'not scored' : `${r.score}/4`
  return `Rubric "${r.label}" — interviewer's score: ${given}\n${levels}`
}

export function buildNotesReviewUserPrompt(input: NotesReviewInput): string {
  const roundLabel = input.round === 1 ? 'Round 1 (Motivation)' : 'Round 2 (Coding)'

  const questions = input.questions.length
    ? input.questions
        .map((q) => {
          const sec = q.section ? ` [${q.section}]` : ''
          const note = q.note.trim() ? q.note.trim() : '(no note written)'
          return `Q${q.n}${sec}: ${q.prompt}\nNote: ${note}`
        })
        .join('\n\n')
    : '(no questions configured)'

  const rubrics = input.rubrics.length
    ? input.rubrics.map(rubricBlock).join('\n\n')
    : '(no rubrics configured)'

  const summary = input.summary.trim() ? input.summary.trim() : '(no summary written)'
  const rec = input.recommendation ? input.recommendation : '(no recommendation yet)'

  return [
    `Candidate: ${input.candidateName}`,
    `Interview: ${roundLabel}`,
    '',
    '=== QUESTIONS & NOTES ===',
    questions,
    '',
    '=== RUBRICS & SCORES ===',
    rubrics,
    '',
    '=== OVERALL ===',
    `Recommendation: ${rec}`,
    `Summary: ${summary}`,
    '',
    'Review the notes now and return the JSON object.',
  ].join('\n')
}

// Strip ```json fences the model sometimes adds despite JSON mode.
function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

function clampScore(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  return r >= 1 && r <= 4 ? r : null
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Parse + normalise the model's JSON. Throws if it isn't JSON at all. */
export function parseNotesReview(raw: string): NotesReviewResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripFences(raw))
  } catch {
    throw new Error('The AI response was not valid JSON.')
  }
  const obj = (parsed ?? {}) as Record<string, unknown>

  const quality = QUALITY_VALUES.includes(obj.quality as NotesReviewResult['quality'])
    ? (obj.quality as NotesReviewResult['quality'])
    : 'adequate'

  const questionGaps: QuestionGap[] = Array.isArray(obj.questionGaps)
    ? (obj.questionGaps as unknown[])
        .map((g) => {
          const o = (g ?? {}) as Record<string, unknown>
          return { question: asString(o.question), issue: asString(o.issue) }
        })
        .filter((g) => g.issue !== '')
    : []

  const ratingChecks: RatingCheck[] = Array.isArray(obj.ratingChecks)
    ? (obj.ratingChecks as unknown[])
        .map((c) => {
          const o = (c ?? {}) as Record<string, unknown>
          return {
            rubric: asString(o.rubric),
            givenScore: clampScore(o.givenScore),
            suggestedScore: clampScore(o.suggestedScore),
            aligned: o.aligned === true,
            rationale: asString(o.rationale),
          }
        })
        .filter((c) => c.rubric !== '')
    : []

  return {
    quality,
    overall: asString(obj.overall),
    questionGaps,
    ratingChecks,
  }
}
