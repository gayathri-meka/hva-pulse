import { describe, it, expect } from 'vitest'
import { optionScore, resolveAnswer, computeSes, configuredSesRubric, isNumericRangeLabel, numericRangeMatches, perCapitaRangesFormPartition, sesMaxScore, effectiveWeight, SES_RUBRIC, updateSesQuestionLabel } from '@/lib/ses'

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

  it('applies an editable label without changing the answer mapping', () => {
    const questions = SES_RUBRIC.map((q) => ({ key: q.key, label: q.key === 'gender' ? 'Your gender' : q.label }))
    const r = computeSes({ gender_raw: 'a' }, undefined, questions)
    expect(r.breakdown[0].label).toBe('Your gender')
    expect(r.score).toBe(15)
  })

  it('applies editable 0–4 option text without changing its numeric score', () => {
    const questions = SES_RUBRIC.map((q) => ({
      key: q.key,
      label: q.label,
      ...(q.key === 'social_category' ? { optionLabels: { '3': 'Scheduled Caste' } } : {}),
    }))
    const r = computeSes({ social_category_raw: 'a' }, undefined, questions)
    expect(r.breakdown[0]).toMatchObject({ answer: 'Scheduled Caste', optionScore: 3, contribution: 15 })
  })

  it('appends a configurable 0–4 question', () => {
    const questions = [...SES_RUBRIC.map(({ key, label }) => ({ key, label })), { key: 'ses_custom_test', label: 'Custom question', answerSource: 'per_capita_income' as const }]
    expect(configuredSesRubric(questions).at(-1)?.rawField).toBe('per_capita_income_raw')
  })

  it('scores a per-capita custom rule and includes it in the breakdown and total', () => {
    const questions = [...SES_RUBRIC.map(({ key, label }) => ({ key, label })), {
      key: 'ses_custom_income', label: 'Per-capita income', answerSource: 'per_capita_income' as const,
      optionLabels: { '0': 'Above ₹2L', '1': '₹1.5L–₹2L', '2': '₹1L–₹1.5L', '3': '₹50k–₹1L', '4': 'Up to ₹50k' },
    }]
    const result = computeSes({ per_capita_income_raw: '75000' }, { ses_custom_income: 2 }, questions)
    expect(result.score).toBe(6)
    expect(result.breakdown.at(-1)).toMatchObject({ key: 'ses_custom_income', optionScore: 3, weight: 2, contribution: 6 })
  })

  it('recognises a per-capita rule saved before answerSource existed', () => {
    const questions = [{
      key: 'ses_custom_legacy', label: 'Per Capita Income (Annual)',
      optionLabels: { '0': '>180000', '1': '120001-180000', '2': '75001-120000', '3': '45001-75000', '4': '<45000' },
    }]
    const result = computeSes({ per_capita_income_raw: '60000' }, { ses_custom_legacy: 5 }, questions)
    expect(result.score).toBe(15)
    expect(result.breakdown[0]).toMatchObject({ key: 'ses_custom_legacy', optionScore: 3, contribution: 15 })
  })

  it('connects an added rule to a categorical source from the catalogue', () => {
    const questions = [{
      key: 'ses_custom_home', label: 'Housing situation', answerSource: 'house_ownership' as const,
      optionLabels: { '1': 'Own home', '2': 'Renting', '3': 'Provided housing', '4': 'Living with relatives' },
    }]
    const result = computeSes({ house_ownership_raw: 'b' }, { ses_custom_home: 3 }, questions)
    expect(result.score).toBe(6)
    expect(result.breakdown[0]).toMatchObject({ answer: 'Renting', optionScore: 2, weight: 3, contribution: 6 })
  })

  it('disconnects a custom source when its question text is cleared', () => {
    expect(updateSesQuestionLabel({
      key: 'ses_custom_wrong', label: 'Wrong source', answerSource: 'assets',
      optionLabels: { '1': 'Insurance' },
    }, '')).toEqual({
      key: 'ses_custom_wrong', label: '', answerSource: undefined,
      optionLabels: { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4' },
    })
  })

  it('does not change the score or maximum for an unconnected custom rule', () => {
    const questions = [...SES_RUBRIC.map(({ key, label }) => ({ key, label })), { key: 'ses_custom_incomplete', label: 'Incomplete' }]
    expect(computeSes({}, undefined, questions).maxScore).toBe(sesMaxScore())
  })

  it('matches Indian currency range labels', () => {
    expect(numericRangeMatches('Up to ₹50k', 50_000)).toBe(true)
    expect(numericRangeMatches('₹50,001–₹1L', 75_000)).toBe(true)
    expect(numericRangeMatches('Above ₹2L', 250_000)).toBe(true)
    expect(isNumericRangeLabel('₹50,001–₹1L')).toBe(true)
    expect(isNumericRangeLabel('some income')).toBe(false)
  })

  it('accepts only a complete, ordered partition of non-negative per-capita income', () => {
    expect(perCapitaRangesFormPartition({
      '0': 'Above ₹2L', '1': '₹1,50,001–₹2L', '2': '₹1,00,001–₹1.5L',
      '3': '₹50,001–₹1L', '4': 'Up to ₹50k',
    })).toBe(true)
    expect(perCapitaRangesFormPartition({
      '0': 'Above ₹2L', '1': '₹1.5L–₹2L', '2': '₹1L–₹1.5L',
      '3': '₹50k–₹1L', '4': 'Up to ₹50k',
    })).toBe(false)
  })
})

describe('effectiveWeight', () => {
  it('uses the override when present, else the default', () => {
    expect(effectiveWeight(q('marital'))).toBe(3)
    expect(effectiveWeight(q('marital'), { marital: 7 })).toBe(7)
  })
})
