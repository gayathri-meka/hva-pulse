import { describe, test, expect, vi, afterEach } from 'vitest'
import {
  mapMarketingEducation,
  mapMarketingReferral,
  MARKETING_EDU_CODE_TO_LABEL,
  MARKETING_REFERRAL_CODE_TO_LABEL,
  onlyDigits,
} from '@/lib/marketingFields'

// The interest-form dropdown options, copied verbatim from InterestForm.tsx.
// If the mapping ever produces a label not in these lists, the <select> shows
// blank even though the map "succeeded" — so we assert the output side too.
const EDUCATION_OPTIONS = [
  'Completed 12th',
  'Currently pursuing degree (graduating 2026)',
  'Currently pursuing degree (graduating 2027)',
  'Currently pursuing degree (graduating 2028 or later)',
  'Completed graduation',
  'Other',
]
const REFERRAL_OPTIONS = [
  'Through an NGO',
  'Referred by a friend or peer',
  'Referred by an HVA alumni',
  'Through my college or university',
  'Through social media',
  'Found it myself (Google / other search)',
  'Other',
]

afterEach(() => vi.restoreAllMocks())

describe('mapMarketingEducation', () => {
  test('every known code maps to a real dropdown label', () => {
    for (const [code, label] of Object.entries(MARKETING_EDU_CODE_TO_LABEL)) {
      expect(mapMarketingEducation(code)).toBe(label)
      expect(EDUCATION_OPTIONS).toContain(label)
    }
  })

  test('accepts the human label as input, not just the code', () => {
    expect(mapMarketingEducation('Completed 12th')).toBe('Completed 12th')
    expect(mapMarketingEducation('Completed graduation')).toBe('Completed graduation')
  })

  test('tolerates casing, whitespace, and separator drift', () => {
    expect(mapMarketingEducation('  COMPLETED_12TH  ')).toBe('Completed 12th')
    expect(mapMarketingEducation('completed-12th')).toBe('Completed 12th')
    expect(mapMarketingEducation('college 2026')).toBe(
      'Currently pursuing degree (graduating 2026)',
    )
  })

  test('empty / nullish returns empty string without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(mapMarketingEducation(null)).toBe('')
    expect(mapMarketingEducation(undefined)).toBe('')
    expect(mapMarketingEducation('   ')).toBe('')
    expect(warn).not.toHaveBeenCalled()
  })

  test('ambiguous / unknown value stays blank AND logs a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // The real-world anomaly: a bare "Completed " can't be resolved to 12th vs
    // graduation, so it must stay blank (prompting the learner) — not guessed.
    expect(mapMarketingEducation('Completed ')).toBe('')
    expect(mapMarketingEducation('high_school_dropout')).toBe('')
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn.mock.calls[0][0]).toContain('educational_status')
  })
})

describe('mapMarketingReferral', () => {
  test('every known code maps to a real dropdown label', () => {
    for (const [code, label] of Object.entries(MARKETING_REFERRAL_CODE_TO_LABEL)) {
      expect(mapMarketingReferral(code)).toBe(label)
      expect(REFERRAL_OPTIONS).toContain(label)
    }
  })

  test('accepts the human label and tolerates drift', () => {
    expect(mapMarketingReferral('Through an NGO')).toBe('Through an NGO')
    expect(mapMarketingReferral('SOCIAL_MEDIA')).toBe('Through social media')
    expect(mapMarketingReferral('  friend ')).toBe('Referred by a friend or peer')
  })

  test('unknown value stays blank AND logs a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(mapMarketingReferral('newspaper')).toBe('')
    expect(warn).toHaveBeenCalledOnce()
    expect(warn.mock.calls[0][0]).toContain('referral_source')
  })
})

describe('onlyDigits', () => {
  test('strips non-digits', () => {
    expect(onlyDigits('+91 98765-43210')).toBe('919876543210')
    expect(onlyDigits(null)).toBe('')
  })
})
