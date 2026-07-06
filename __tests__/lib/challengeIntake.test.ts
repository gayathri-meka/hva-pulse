import { describe, it, expect } from 'vitest'
import { parseIntake, parseSalary, type IntakeRaw } from '@/lib/challengeIntake'

describe('parseSalary', () => {
  it('reads plain and formatted rupee amounts as monthly figures', () => {
    expect(parseSalary('30,000')).toBe(30000)
    expect(parseSalary('₹8,000 per month')).toBe(8000)
    expect(parseSalary('15,000rs')).toBe(15000)
    expect(parseSalary('22,000 per month')).toBe(22000)
    expect(parseSalary('13406')).toBe(13406)
  })

  it('expands k-suffixed shorthand', () => {
    expect(parseSalary('10k')).toBe(10000)
    expect(parseSalary('30 k')).toBe(30000)
  })

  it('treats explicit no-income / not-applicable as zero', () => {
    expect(parseSalary('Not Applicable')).toBe(0)
    expect(parseSalary('no fixed income')).toBe(0)
    expect(parseSalary('no income')).toBe(0)
    expect(parseSalary('0')).toBe(0)
    expect(parseSalary('₹0 per month')).toBe(0)
  })

  it('returns undefined for stray letters / junk (→ manual review, not eliminate)', () => {
    expect(parseSalary('a')).toBeUndefined()
    expect(parseSalary('Not 🚭')).toBeUndefined()
    expect(parseSalary('')).toBeUndefined() // blank = never answered → unknown, not 0
  })
})

describe('parseIntake', () => {
  // A currently-studying, not-working candidate finishing in 2029.
  it('infers full-time for a studying, non-working candidate', () => {
    const raw: IntakeRaw = {
      studying_raw: 'a',
      grad_year_raw: '2029',
      work_domain_raw: 'c', // Not Applicable → not working
      salary_raw: 'Not Applicable',
      willing_raw: 'd',
    }
    const s = parseIntake(raw)
    expect(s.graduationYear).toBe(2029)
    expect(s.working).toBe(false)
    expect(s.studyMode).toBe('full_time')
    expect(s.monthlySalaryInr).toBe(0)
  })

  it('infers part-time for a studying AND working candidate', () => {
    const s = parseIntake({ studying_raw: 'a', grad_year_raw: '2029', work_domain_raw: 'a', salary_raw: '20000', willing_raw: 'a' })
    expect(s.studyMode).toBe('part_time')
    expect(s.working).toBe(true)
    expect(s.willingToQuit).toBe(true)
    expect(s.monthlySalaryInr).toBe(20000)
  })

  it('drops graduation year + mode for a non-student', () => {
    const s = parseIntake({ studying_raw: 'b', grad_year_raw: '2027', work_domain_raw: 'a' })
    expect(s.graduationYear).toBeUndefined()
    expect(s.studyMode).toBeUndefined()
    expect(s.working).toBe(true)
  })

  it('leaves study mode undefined when work status is unknown', () => {
    const s = parseIntake({ studying_raw: 'a', grad_year_raw: '2028', work_domain_raw: 'garbage' })
    expect(s.graduationYear).toBe(2028)
    expect(s.working).toBeUndefined()
    expect(s.studyMode).toBeUndefined()
  })

  it('maps willingness options (yes/no pass through, not-sure/NA → undefined)', () => {
    expect(parseIntake({ willing_raw: 'a' }).willingToQuit).toBe(true)
    expect(parseIntake({ willing_raw: 'b' }).willingToQuit).toBe(false)
    expect(parseIntake({ willing_raw: 'c' }).willingToQuit).toBeUndefined() // not sure
    expect(parseIntake({ willing_raw: 'd' }).willingToQuit).toBeUndefined() // not applicable
  })

  it('accepts free-text synonyms for option answers', () => {
    const s = parseIntake({ studying_raw: 'Yes', work_domain_raw: 'Tech', willing_raw: 'No' })
    expect(s.studyMode).toBe('part_time') // studying + working
    expect(s.working).toBe(true)
    expect(s.willingToQuit).toBe(false)
  })

  it('handles an entirely empty intake row', () => {
    const s = parseIntake({})
    expect(s.working).toBeUndefined()
    expect(s.graduationYear).toBeUndefined()
    expect(s.studyMode).toBeUndefined()
    expect(s.willingToQuit).toBeUndefined()
  })
})
