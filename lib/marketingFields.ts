// Maps the codes the marketing apply form stores in learner_applications to the
// human-readable labels used by Pulse's interest form dropdowns. Used by the
// auth callback (to auto-populate a prospect on signup) and the interest form
// page (prefill fallback). Unknown codes map to '' so we never store a raw code.

export const MARKETING_EDU_CODE_TO_LABEL: Record<string, string> = {
  completed_12th:       'Completed 12th',
  college_2026:         'Currently pursuing degree (graduating 2026)',
  college_2027:         'Currently pursuing degree (graduating 2027)',
  // TODO: confirm the exact code the form stores for "graduating 2028 or later".
  college_2028:         'Currently pursuing degree (graduating 2028 or later)',
  college_after_2027:   'Currently pursuing degree (graduating 2028 or later)',
  completed_graduation: 'Completed graduation',
  other:                'Other',
}

// TODO: confirm these codes with the marketing form. Only `search` is verified
// from live data. Unknown codes fall back to manual entry (no auto-submit), so
// a wrong guess degrades gracefully rather than storing garbage.
export const MARKETING_REFERRAL_CODE_TO_LABEL: Record<string, string> = {
  ngo:     'Through an NGO',
  friend:  'Referred by a friend or peer',
  alumni:  'Referred by an HVA alumni',
  college: 'Through my college or university',
  social:  'Through social media',
  search:  'Found it myself (Google / other search)',
  other:   'Other',
}

export function mapMarketingEducation(code: string | null | undefined): string {
  const c = code?.trim()
  return c ? MARKETING_EDU_CODE_TO_LABEL[c] ?? '' : ''
}

export function mapMarketingReferral(code: string | null | undefined): string {
  const c = code?.trim()
  return c ? MARKETING_REFERRAL_CODE_TO_LABEL[c] ?? '' : ''
}

export const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
