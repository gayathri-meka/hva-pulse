// SensAI grading evals — shared types + pure aggregation.
//
// The team tags the AI grader's output on a (learner, question) as correct or
// incorrect, and when incorrect picks one or more observed SYMPTOMS (what's wrong
// with the output — NOT the root cause; diagnosis of scorecard-gap vs prompt-issue
// happens downstream). Accuracy + failure-mode counts are computed from the labels.

export const EVAL_CONTEXT_SCREENING = 'screening'

// Observed symptoms — deliberately symptoms, not root causes. Add here to extend.
export const EVAL_SYMPTOMS = [
  { key: 'inaccurate_score', label: 'Inaccurate score' },
  { key: 'vague_feedback', label: 'Vague / unhelpful feedback' },
  { key: 'gives_away_answer', label: 'Gives away the answer' },
] as const

export type EvalSymptom = (typeof EVAL_SYMPTOMS)[number]['key']
export const EVAL_SYMPTOM_KEYS: EvalSymptom[] = EVAL_SYMPTOMS.map((s) => s.key)
export const symptomLabel = (key: string): string =>
  EVAL_SYMPTOMS.find((s) => s.key === key)?.label ?? key

export type EvalVerdict = 'correct' | 'incorrect'

export type GradingEval = {
  questionId: string
  learnerEmail: string
  verdict: EvalVerdict
  symptoms: string[]
  comment: string | null
  labeledByName: string | null
  updatedAt: string
}

export type EvalStats = {
  total: number
  correct: number
  incorrect: number
  accuracyPct: number | null // null when nothing labeled yet
  bySymptom: Record<string, number>
}

/** Grader accuracy + symptom breakdown over a set of labels. */
export function computeEvalStats(labels: Pick<GradingEval, 'verdict' | 'symptoms'>[]): EvalStats {
  const bySymptom: Record<string, number> = {}
  let correct = 0
  for (const l of labels) {
    if (l.verdict === 'correct') correct++
    else for (const s of l.symptoms) bySymptom[s] = (bySymptom[s] ?? 0) + 1
  }
  const total = labels.length
  return {
    total,
    correct,
    incorrect: total - correct,
    accuracyPct: total > 0 ? Math.round((100 * correct) / total) : null,
    bySymptom,
  }
}

/** Group labels by question and compute per-question stats. */
export function statsByQuestion(
  labels: (Pick<GradingEval, 'verdict' | 'symptoms'> & { questionId: string })[],
): Record<string, EvalStats> {
  const byQ = new Map<string, Pick<GradingEval, 'verdict' | 'symptoms'>[]>()
  for (const l of labels) {
    if (!byQ.has(l.questionId)) byQ.set(l.questionId, [])
    byQ.get(l.questionId)!.push(l)
  }
  const out: Record<string, EvalStats> = {}
  for (const [qid, ls] of byQ) out[qid] = computeEvalStats(ls)
  return out
}

/** Validate a label before it's stored. Incorrect verdicts need ≥1 known symptom. */
export function validateEvalInput(input: {
  verdict: string
  symptoms: string[]
}): { ok: true } | { ok: false; error: string } {
  if (input.verdict !== 'correct' && input.verdict !== 'incorrect')
    return { ok: false, error: 'Pick whether the feedback is right or wrong.' }
  const symptoms = input.symptoms ?? []
  if (symptoms.some((s) => !EVAL_SYMPTOM_KEYS.includes(s as EvalSymptom)))
    return { ok: false, error: 'Unknown symptom.' }
  if (input.verdict === 'incorrect' && symptoms.length === 0)
    return { ok: false, error: 'Pick at least one thing that was wrong.' }
  return { ok: true }
}
