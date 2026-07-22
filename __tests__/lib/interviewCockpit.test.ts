import { describe, it, expect } from 'vitest'
import {
  questionsForRound,
  rubricsForRound,
  averageScore,
  isValidScoreForRubric,
  scoreTone,
  formatScore,
  isValidRecommendation,
  type InterviewQuestion,
  type InterviewRubric,
} from '@/lib/interviewCockpit'

const q = (id: string, round: 1 | 2 | null, ordering: number, active = true): InterviewQuestion => ({
  id, round, section: null, ordering, prompt: id, purpose: null, strongAnswer: null, weakAnswer: null, probe: null, active,
})
const rub = (key: string, round: 1 | 2 | null, ordering: number, scores: number[], active = true): InterviewRubric => ({
  key, label: key, round, ordering, note: null, active,
  levels: scores.map((s) => ({ score: s, descriptor: `d${s}`, lookingFor: '', example: '' })),
})

describe('questionsForRound', () => {
  it('returns shared (null) + round-specific questions, ordered, active only', () => {
    const all = [q('b', null, 2), q('r2', 2, 1), q('r1', 1, 3), q('a', null, 1), q('off', 1, 0, false)]
    expect(questionsForRound(all, 1).map((x) => x.id)).toEqual(['a', 'b', 'r1'])
    expect(questionsForRound(all, 2).map((x) => x.id)).toEqual(['r2', 'a', 'b'])
  })
})

describe('rubricsForRound', () => {
  it('returns shared (null) + round-specific rubrics, ordered, active only', () => {
    const all = [rub('shared', null, 2, [1, 2]), rub('coding', 2, 1, [2, 4]), rub('motiv', 1, 1, [1, 4]), rub('off', 1, 0, [1], false)]
    expect(rubricsForRound(all, 1).map((r) => r.key)).toEqual(['motiv', 'shared'])
    expect(rubricsForRound(all, 2).map((r) => r.key)).toEqual(['coding', 'shared'])
  })
})

describe('averageScore', () => {
  it('averages scored rubrics, rounded to 0.1', () => {
    expect(averageScore({ need: 3, drive: 4 })).toBe(3.5)
    expect(averageScore({ a: 1, b: 2, c: 4 })).toBe(2.3)
  })
  it('handles fractional scores', () => {
    expect(averageScore({ a: 2.5, b: 3.5 })).toBe(3)
  })
  it('is null when nothing scored', () => {
    expect(averageScore({})).toBeNull()
  })
})

describe('isValidScoreForRubric', () => {
  const r = rub('articulation', 1, 1, [1, 2, 2.5, 3, 3.5, 4])
  it('accepts a score on the rubric scale (incl. fractional)', () => {
    expect(isValidScoreForRubric(2.5, r)).toBe(true)
    expect(isValidScoreForRubric(4, r)).toBe(true)
  })
  it('rejects a score not on the scale', () => {
    expect(isValidScoreForRubric(2.75, r)).toBe(false)
    expect(isValidScoreForRubric(5, r)).toBe(false)
    expect(isValidScoreForRubric(1.5, rub('reading', 2, 1, [2, 3, 3.5, 4]))).toBe(false)
  })
})

describe('scoreTone', () => {
  it('bands weak → strong', () => {
    expect(scoreTone(1)).toBe('red')
    expect(scoreTone(2)).toBe('amber')
    expect(scoreTone(2.5)).toBe('orange')
    expect(scoreTone(3)).toBe('orange')
    expect(scoreTone(3.5)).toBe('emerald')
    expect(scoreTone(4)).toBe('emerald')
  })
})

describe('formatScore', () => {
  it('drops trailing .0 but keeps halves', () => {
    expect(formatScore(3)).toBe('3')
    expect(formatScore(2.5)).toBe('2.5')
  })
})

describe('isValidRecommendation', () => {
  it('validates the recommendation keys', () => {
    expect(isValidRecommendation('advance')).toBe(true)
    expect(isValidRecommendation('no')).toBe(true)
    expect(isValidRecommendation('maybe')).toBe(false)
  })
})
