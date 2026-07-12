import { describe, it, expect } from 'vitest'
import { optionScore, resolveAnswer, computeSes, sesMaxScore, effectiveWeight, SES_RUBRIC } from '@/lib/ses'

const q = (key: string) => SES_RUBRIC.find((x) => x.key === key)!

describe('optionScore', () => {
  it('maps letters to their rubric score (order-independent)', () => {
    // social category: a.SC=3, b.ST=4, c.OBC=2, d.General=1 — letters ≠ score order.
    expect(optionScore(q('social_category'), 'a')).toBe(3)
    expect(optionScore(q('social_category'), 'd')).toBe(1)
    expect(optionScore(q('social_category'), 'b')).toBe(4)
  })

  it('scores prefer-not-to-say as 1 (lowest need) on every PNS question', () => {
    expect(optionScore(q('marital'), 'e')).toBe(1)
    expect(optionScore(q('social_category'), 'e')).toBe(1)
    expect(optionScore(q('family_situation'), 'e')).toBe(1)
    expect(optionScore(q('gender'), 'd')).toBe(1)
  })

  it('scores gender, with PNS as the options average', () => {
    expect(optionScore(q('gender'), 'a')).toBe(3) // Female
    expect(optionScore(q('gender'), 'b')).toBe(2) // Male
    expect(optionScore(q('gender'), 'c')).toBe(4) // Transgender
    expect(optionScore(q('gender'), 'd')).toBe(1) // PNS = 1
  })

  it('scores multi-select assets by the best (lowest-need) option held', () => {
    expect(optionScore(q('assets'), 'a')).toBe(1) // insurance
    expect(optionScore(q('assets'), 'a, c')).toBe(1) // has insurance + savings → best = insurance
    expect(optionScore(q('assets'), 'c')).toBe(3) // only savings
    expect(optionScore(q('assets'), 'd')).toBe(4) // none of the above
  })

  it('handles the loan scale starting at 0 (no loans)', () => {
    expect(optionScore(q('loan_informal'), 'a')).toBe(0)
    expect(optionScore(q('loan_informal'), 'e')).toBe(4)
  })

  it('returns null for blank / unrecognised answers', () => {
    expect(optionScore(q('marital'), '')).toBeNull()
    expect(optionScore(q('marital'), 'z')).toBeNull()
  })
})

describe('resolveAnswer (score + label for the breakdown)', () => {
  it('returns the chosen option label', () => {
    expect(resolveAnswer(q('social_category'), 'a')).toEqual({ score: 3, label: 'SC' })
    expect(resolveAnswer(q('marital'), 'e')).toEqual({ score: 1, label: 'Prefer not to say' })
    expect(resolveAnswer(q('gender'), 'd')).toEqual({ score: 1, label: 'Prefer not to say' })
    expect(resolveAnswer(q('assets'), 'a, c')).toEqual({ score: 1, label: 'Insurance, FD / savings' })
  })
})

describe('computeSes', () => {
  it('records the answer label in the breakdown', () => {
    const r = computeSes({ social_category_raw: 'a' })
    expect(r.breakdown[0]).toMatchObject({ key: 'social_category', answer: 'SC', optionScore: 3, weight: 5, contribution: 15 })
  })

  it('sums option score × weight over answered questions', () => {
    // social_category a=SC=3 × weight 5 = 15; marital b=Unmarried=2 × 3 = 6 → 21.
    const r = computeSes({ social_category_raw: 'a', marital_raw: 'b' })
    expect(r.score).toBe(21)
    expect(r.answered).toBe(2)
    expect(r.total).toBe(SES_RUBRIC.length)
  })

  it('respects weight overrides', () => {
    const r = computeSes({ social_category_raw: 'a' }, { social_category: 10 })
    expect(r.score).toBe(30) // 3 × 10
  })

  it('skips unanswered questions (contribute 0, not counted)', () => {
    const r = computeSes({})
    expect(r.score).toBe(0)
    expect(r.answered).toBe(0)
  })

  it('maxScore reflects top option × weight across the rubric', () => {
    // Deterministic given default weights; must be positive and match the helper.
    expect(computeSes({}).maxScore).toBe(sesMaxScore())
    expect(sesMaxScore()).toBeGreaterThan(0)
  })
})

describe('effectiveWeight', () => {
  it('uses the override when present, else the default', () => {
    expect(effectiveWeight(q('marital'))).toBe(3)
    expect(effectiveWeight(q('marital'), { marital: 7 })).toBe(7)
  })
})
