import { describe, it, expect } from 'vitest'
import { parseIntake, parseSalary, parseCount, type IntakeRaw } from '@/lib/challengeIntake'

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

  it('expands lakh / crore shorthand (for family income)', () => {
    expect(parseSalary('5 lakh')).toBe(500000)
    expect(parseSalary('5l')).toBe(500000)
    expect(parseSalary('1.5 lakh')).toBe(150000)
    expect(parseSalary('2 lac')).toBe(200000)
    expect(parseSalary('1 crore')).toBe(10000000)
    // Indian comma grouping without a scale word still reads plainly.
    expect(parseSalary('8,40,000')).toBe(840000)
    expect(parseSalary('Rs. 5,00,000 per year')).toBe(500000)
  })
})

describe('parseCount', () => {
  it('reads a plausible family-size integer', () => {
    expect(parseCount('5')).toBe(5)
    expect(parseCount('5 members')).toBe(5)
    expect(parseCount('we are 4')).toBe(4)
  })
  it('rejects blanks, zero, and implausible sizes', () => {
    expect(parseCount('')).toBeUndefined()
    expect(parseCount('0')).toBeUndefined()
    expect(parseCount('100')).toBeUndefined()
    expect(parseCount('none')).toBeUndefined()
  })
})

describe('parseIntake', () => {
  it('reads a current student with a completion year', () => {
    const raw: IntakeRaw = {
      studying_raw: 'a',
      grad_year_raw: '2029',
      work_domain_raw: 'c', // Not Applicable → not working
      salary_raw: 'Not Applicable',
      willing_raw: 'd',
    }
    const s = parseIntake(raw)
    expect(s.currentlyStudying).toBe(true)
    expect(s.graduationYear).toBe(2029)
    expect(s.working).toBe(false)
  })

  it('reads a working student', () => {
    const s = parseIntake({ studying_raw: 'a', grad_year_raw: '2029', work_domain_raw: 'a', salary_raw: '20000', willing_raw: 'a' })
    expect(s.currentlyStudying).toBe(true)
    expect(s.working).toBe(true)
    expect(s.willingToQuit).toBe(true)
  })

  it('parses family income and size for the per-capita signal', () => {
    const s = parseIntake({ family_income_raw: '8,40,000', family_size_raw: '6' })
    expect(s.familyAnnualIncomeInr).toBe(840000)
    expect(s.familySize).toBe(6)
  })

  it('parses course type and the candidate’s own monthly salary', () => {
    expect(parseIntake({ course_type_raw: 'a' }).courseType).toBe('full_time')
    expect(parseIntake({ course_type_raw: 'c' }).courseType).toBe('distance')
    expect(parseIntake({ course_type_raw: 'Online' }).courseType).toBe('online')
    expect(parseIntake({ course_type_raw: 'e' }).courseType).toBeUndefined() // Not applicable
    expect(parseIntake({ salary_raw: '40,000' }).monthlySalaryInr).toBe(40000)
    expect(parseIntake({ salary_raw: 'Not Applicable' }).monthlySalaryInr).toBe(0)
  })

  it('drops the graduation year for a non-student (available now)', () => {
    const s = parseIntake({ studying_raw: 'b', grad_year_raw: '2027', work_domain_raw: 'a' })
    expect(s.currentlyStudying).toBe(false)
    expect(s.graduationYear).toBeUndefined()
    expect(s.working).toBe(true)
  })

  it('maps willingness options (yes/no pass through, not-sure/NA → undefined)', () => {
    expect(parseIntake({ willing_raw: 'a' }).willingToQuit).toBe(true)
    expect(parseIntake({ willing_raw: 'b' }).willingToQuit).toBe(false)
    expect(parseIntake({ willing_raw: 'c' }).willingToQuit).toBeUndefined() // not sure
    expect(parseIntake({ willing_raw: 'd' }).willingToQuit).toBeUndefined() // not applicable
  })

  it('accepts free-text synonyms for option answers', () => {
    const s = parseIntake({ studying_raw: 'Yes', work_domain_raw: 'Tech', willing_raw: 'No' })
    expect(s.currentlyStudying).toBe(true)
    expect(s.working).toBe(true)
    expect(s.willingToQuit).toBe(false)
  })

  it('handles an entirely empty intake row', () => {
    const s = parseIntake({})
    expect(s.working).toBeUndefined()
    expect(s.currentlyStudying).toBeUndefined()
    expect(s.graduationYear).toBeUndefined()
    expect(s.willingToQuit).toBeUndefined()
  })
})
