import { describe, it, expect } from 'vitest'
import { questionsForRound, averageScore, isValidScore, isValidRecommendation, type InterviewQuestion } from '@/lib/interviewCockpit'

const q = (id: string, round: 1 | 2 | null, ordering: number, active = true): InterviewQuestion => ({
  id, round, ordering, prompt: id, purpose: null, strongAnswer: null, weakAnswer: null, probe: null, active,
})

describe('questionsForRound', () => {
  it('returns shared (null) + round-specific questions, ordered, active only', () => {
    const all = [q('b', null, 2), q('r2', 2, 1), q('r1', 1, 3), q('a', null, 1), q('off', 1, 0, false)]
    expect(questionsForRound(all, 1).map((x) => x.id)).toEqual(['a', 'b', 'r1']) // ordering 1,2,3
    expect(questionsForRound(all, 2).map((x) => x.id)).toEqual(['r2', 'a', 'b']) // ordering 1,1,2
  })
})

describe('averageScore', () => {
  it('averages scored rubrics, rounded to 0.1', () => {
    expect(averageScore({ need: 3, drive: 4 })).toBe(3.5)
    expect(averageScore({ a: 1, b: 2, c: 4 })).toBe(2.3) // 7/3 = 2.33
  })
  it('is null when nothing scored', () => {
    expect(averageScore({})).toBeNull()
  })
})

describe('isValidScore', () => {
  it('accepts 1–4 integers only', () => {
    expect(isValidScore(1)).toBe(true)
    expect(isValidScore(4)).toBe(true)
    expect(isValidScore(0)).toBe(false)
    expect(isValidScore(5)).toBe(false)
    expect(isValidScore(2.5)).toBe(false)
  })
})

describe('isValidRecommendation', () => {
  it('validates the recommendation keys', () => {
    expect(isValidRecommendation('advance')).toBe(true)
    expect(isValidRecommendation('no')).toBe(true)
    expect(isValidRecommendation('maybe')).toBe(false)
  })
})
