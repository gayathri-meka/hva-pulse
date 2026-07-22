// Interview cockpit — shared types + pure helpers for the note-taking / scoring UI.

export type InterviewQuestion = {
  id: string
  round: 1 | 2 | null // null = both rounds
  section: string | null // bucket tag (General / Drive / Need / …)
  ordering: number
  prompt: string
  purpose: string | null
  strongAnswer: string | null
  weakAnswer: string | null
  probe: string | null
  active: boolean
}

// A rubric level is an anchor on a scale. The scale is per-rubric and can be
// fractional / uneven (e.g. Articulation = 1,2,2.5,3,3.5,4) and needn't start at 1.
export type RubricLevel = {
  score: number
  descriptor: string // what this level means
  lookingFor: string // what to look for (optional)
  example: string // calibration example (optional)
}

export type InterviewRubric = {
  key: string
  label: string
  round: 1 | 2 | null // which round this rubric applies to (null = both)
  ordering: number
  note: string | null // interviewer guidance for the whole rubric (how to assess)
  levels: RubricLevel[] // sorted ascending by score
  active: boolean
}

export const RECOMMENDATIONS = [
  { key: 'advance', label: 'Advance' },
  { key: 'borderline', label: 'Borderline' },
  { key: 'no', label: 'Do not advance' },
] as const
export type Recommendation = (typeof RECOMMENDATIONS)[number]['key']

/** Questions asked in a given round: round-specific ones + shared (null), ordered. */
export function questionsForRound(questions: InterviewQuestion[], round: 1 | 2): InterviewQuestion[] {
  return questions
    .filter((q) => q.active && (q.round === null || q.round === round))
    .sort((a, b) => a.ordering - b.ordering)
}

/** Rubrics for a given round: round-specific + shared (null), ordered. */
export function rubricsForRound(rubrics: InterviewRubric[], round: 1 | 2): InterviewRubric[] {
  return rubrics
    .filter((r) => r.active && (r.round === null || r.round === round))
    .sort((a, b) => a.ordering - b.ordering)
}

/** Average rubric score (of scored rubrics), or null if none scored. Rounded to 0.1. */
export function averageScore(scores: Record<string, number>): number | null {
  const vals = Object.values(scores).filter((v) => Number.isFinite(v) && v > 0)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

/** The allowed score values for a rubric (from its levels). */
export function rubricScores(rubric: Pick<InterviewRubric, 'levels'>): number[] {
  return rubric.levels.map((l) => l.score)
}

/** A score is valid for a rubric iff it is one of that rubric's level scores. */
export function isValidScoreForRubric(score: number, rubric: Pick<InterviewRubric, 'levels'>): boolean {
  return rubric.levels.some((l) => l.score === score)
}

/** Weak→strong colour band for a score. All interview scales top out at 4. */
export function scoreTone(value: number): 'red' | 'amber' | 'orange' | 'emerald' {
  if (value >= 3.5) return 'emerald'
  if (value >= 2.5) return 'orange'
  if (value >= 1.5) return 'amber'
  return 'red'
}

/** Render a score without a trailing .0 (2.5 → "2.5", 3 → "3"). */
export function formatScore(value: number): string {
  return String(value)
}

export function isValidRecommendation(r: string): r is Recommendation {
  return RECOMMENDATIONS.some((x) => x.key === r)
}
