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

export type InterviewRubric = {
  key: string
  label: string
  ordering: number
  levels: [string, string, string, string] // anchors for scores 1..4
  lookingFor: [string, string, string, string] // what to look for at each score 1..4
  examples: [string, string, string, string] // calibration examples per score 1..4
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

/** Average rubric score (of scored rubrics), or null if none scored. Rounded to 0.1. */
export function averageScore(scores: Record<string, number>): number | null {
  const vals = Object.values(scores).filter((v) => v >= 1 && v <= 4)
  if (!vals.length) return null
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
}

/** A rubric score is valid iff it's an integer 1–4. */
export function isValidScore(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 4
}

export function isValidRecommendation(r: string): r is Recommendation {
  return RECOMMENDATIONS.some((x) => x.key === r)
}
