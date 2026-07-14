import { describe, it, expect } from 'vitest'
import { decodeAnswer, intakeDossierFields } from '@/lib/challengeIntakeDisplay'

describe('decodeAnswer', () => {
  const map = { a: 'Not working', b: 'Working full-time', c: 'Working part-time' }
  it('decodes a leading option letter in various formats', () => {
    expect(decodeAnswer('a', map)).toBe('Not working')
    expect(decodeAnswer('b.', map)).toBe('Working full-time')
    expect(decodeAnswer('c)', map)).toBe('Working part-time')
    expect(decodeAnswer('b. Yes, I am working full-time', map)).toBe('Working full-time')
  })
  it('passes through free text (no map, or unmatched)', () => {
    expect(decodeAnswer('TCS Bangalore')).toBe('TCS Bangalore')
    expect(decodeAnswer('I want to support my family', map)).toBe('I want to support my family')
  })
  it('shows an em-dash for blank/nullish answers', () => {
    expect(decodeAnswer('')).toBe('—')
    expect(decodeAnswer(null)).toBe('—')
    expect(decodeAnswer('   ', map)).toBe('—')
  })
})

describe('intakeDossierFields', () => {
  it('returns [] when there is no intake data', () => {
    expect(intakeDossierFields(null)).toEqual([])
    expect(intakeDossierFields({})).toEqual([])
  })
  it('builds decoded, grouped fields from raw answers', () => {
    const groups = intakeDossierFields({
      why_hva_raw: 'To become independent',
      working_raw: 'b',
      earning_members_raw: '2',
      urgency_raw: 'a',
      placement_raw: 'e',
    })
    const flat = Object.fromEntries(groups.flatMap((g) => g.fields.map((f) => [f.label, f.value])))
    expect(flat['Why join HVA']).toBe('To become independent')
    expect(flat['Currently working']).toBe('Working full-time')
    expect(flat['Earning members']).toBe('2')
    expect(flat['How urgently needs a job']).toBe('Immediately')
    expect(flat['College placement opportunities']).toBe('Very limited')
    // unanswered fields still render as em-dash
    expect(flat['Company / org']).toBe('—')
    expect(groups.map((g) => g.group)).toContain('Jobs & placement')
  })
})
