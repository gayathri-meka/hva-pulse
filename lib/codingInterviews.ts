export const CODING_INTERVIEWERS = ['Jija', 'Anuj', 'Manisha', 'Gyan'] as const
export const CODING_SCORES = [1, 2, 2.5, 3, 3.5, 4] as const

export type CodingInterviewStatus = 'not_started' | 'completed'
export type CodingVerdict = 'selected' | 'rejected'
export type CodingInterviewer = typeof CODING_INTERVIEWERS[number]

export type CodingInterviewRow = {
  email: string
  name: string | null
  interviewStatus: CodingInterviewStatus
  verdict: CodingVerdict | null
  interviewDate: string | null
  interviewTime: string | null
  preInterviewNotes: string
  interviewer: CodingInterviewer | null
  problemsAsked: string
  codingScore: number | null
  readingComprehensionScore: number | null
  learnabilityObservations: string
  notes: string
  summary: string
}

export const CODING_FIELD_TO_COLUMN = {
  interviewStatus: 'interview_status', verdict: 'verdict', interviewDate: 'interview_date', interviewTime: 'interview_time',
  preInterviewNotes: 'pre_interview_notes', interviewer: 'interviewer', problemsAsked: 'problems_asked',
  codingScore: 'coding_score', readingComprehensionScore: 'reading_comprehension_score',
  learnabilityObservations: 'learnability_observations', notes: 'notes', summary: 'summary',
} as const

export type CodingInterviewField = keyof typeof CODING_FIELD_TO_COLUMN
