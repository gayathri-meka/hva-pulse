import { describe, it, expect } from 'vitest'
import { computeEvalStats, statsByQuestion, validateEvalInput } from '@/lib/evals'

describe('computeEvalStats', () => {
  it('computes accuracy and tallies symptoms from incorrect labels only', () => {
    const s = computeEvalStats([
      { verdict: 'correct', symptoms: [] },
      { verdict: 'correct', symptoms: [] },
      { verdict: 'incorrect', symptoms: ['inaccurate_score', 'vague_feedback'] },
      { verdict: 'incorrect', symptoms: ['inaccurate_score'] },
    ])
    expect(s.total).toBe(4)
    expect(s.correct).toBe(2)
    expect(s.incorrect).toBe(2)
    expect(s.accuracyPct).toBe(50)
    expect(s.bySymptom).toEqual({ inaccurate_score: 2, vague_feedback: 1 })
  })

  it('returns null accuracy when nothing is labeled', () => {
    expect(computeEvalStats([]).accuracyPct).toBeNull()
  })
})

describe('statsByQuestion', () => {
  it('groups labels by question', () => {
    const by = statsByQuestion([
      { questionId: 'q1', verdict: 'correct', symptoms: [] },
      { questionId: 'q1', verdict: 'incorrect', symptoms: ['vague_feedback'] },
      { questionId: 'q2', verdict: 'correct', symptoms: [] },
    ])
    expect(by.q1.accuracyPct).toBe(50)
    expect(by.q2.accuracyPct).toBe(100)
  })
})

describe('validateEvalInput', () => {
  it('accepts a correct verdict with no symptoms', () => {
    expect(validateEvalInput({ verdict: 'correct', symptoms: [] }).ok).toBe(true)
  })
  it('requires at least one symptom when incorrect', () => {
    const r = validateEvalInput({ verdict: 'incorrect', symptoms: [] })
    expect(r).toEqual({ ok: false, error: expect.stringContaining('at least one') })
  })
  it('accepts an incorrect verdict with a known symptom', () => {
    expect(validateEvalInput({ verdict: 'incorrect', symptoms: ['gives_away_answer'] }).ok).toBe(true)
  })
  it('rejects an unknown symptom', () => {
    expect(validateEvalInput({ verdict: 'incorrect', symptoms: ['made_up'] }).ok).toBe(false)
  })
  it('rejects an invalid verdict', () => {
    expect(validateEvalInput({ verdict: 'maybe', symptoms: [] }).ok).toBe(false)
  })
})
