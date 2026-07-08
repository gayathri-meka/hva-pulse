import { describe, it, expect } from 'vitest'
import { parseModelJSON, normalizeInspect, verdictFor, DIMENSION_ORDER } from '@/lib/tools/scorecard'

describe('parseModelJSON', () => {
  it('parses plain JSON', () => {
    expect(parseModelJSON<{ a: number }>('{"a":1}').a).toBe(1)
  })
  it('strips code fences and surrounding prose', () => {
    expect(parseModelJSON<{ score: number }>('Here you go:\n```json\n{"score": 82}\n```\nThanks!').score).toBe(82)
  })
  it('throws on non-JSON', () => {
    expect(() => parseModelJSON('no json here')).toThrow()
  })
})

describe('normalizeInspect', () => {
  it('clamps the score to 0–100 and rounds it', () => {
    expect(normalizeInspect({ score: 140 }).score).toBe(100)
    expect(normalizeInspect({ score: -5 }).score).toBe(0)
    expect(normalizeInspect({ score: 72.6 }).score).toBe(73)
  })
  it('forces all six dimensions, in canonical order, filling gaps', () => {
    const r = normalizeInspect({
      score: 50,
      dimensions: [{ name: 'AI-scorability', rating: 'weak', note: 'x' }],
    })
    expect(r.dimensions.map((d) => d.name)).toEqual([...DIMENSION_ORDER])
    // Provided dimension is kept; missing ones default to 'partial'.
    expect(r.dimensions.find((d) => d.name === 'AI-scorability')!.rating).toBe('weak')
    expect(r.dimensions.find((d) => d.name === 'Observable descriptors')!.rating).toBe('partial')
  })
  it('caps issues at four', () => {
    const issues = Array.from({ length: 6 }, (_, i) => ({ snippet: `s${i}`, problem: 'p', fix: 'f' }))
    expect(normalizeInspect({ score: 10, issues }).issues).toHaveLength(4)
  })
})

describe('verdictFor', () => {
  it('maps score to the three bands', () => {
    expect(verdictFor(30)).toBe('Too vague')
    expect(verdictFor(50)).toBe('Needs tightening')
    expect(verdictFor(74)).toBe('Needs tightening')
    expect(verdictFor(75)).toBe('Ready')
  })
})
