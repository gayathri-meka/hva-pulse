// Maps the codes the marketing apply form stores in learner_applications to the
// human-readable labels used by Pulse's interest form dropdowns. Used by the
// auth callback (to auto-populate a prospect on signup) and the interest form
// page (prefill fallback).
//
// These code→label tables are the canonical source of truth. The values MUST
// stay byte-for-byte identical to the dropdown options in InterestForm.tsx
// (EDUCATION_OPTIONS / REFERRAL_OPTIONS) — otherwise a "successful" map produces
// a string the <select> can't match and the prefill silently shows blank.

// Codes verified against the marketing apply form.
export const MARKETING_EDU_CODE_TO_LABEL: Record<string, string> = {
  completed_12th:       'Completed 12th',
  college_2026:         'Currently pursuing degree (graduating 2026)',
  college_2027:         'Currently pursuing degree (graduating 2027)',
  college_2028:         'Currently pursuing degree (graduating 2028 or later)',
  completed_graduation: 'Completed graduation',
  other:                'Other',
}

// Codes verified against the marketing apply form.
export const MARKETING_REFERRAL_CODE_TO_LABEL: Record<string, string> = {
  ngo:          'Through an NGO',
  friend:       'Referred by a friend or peer',
  alumni:       'Referred by an HVA alumni',
  college:      'Through my college or university',
  social_media: 'Through social media',
  search:       'Found it myself (Google / other search)',
  other:        'Other',
}

// Fold a code or label down to a comparison key: lowercase, and collapse every
// run of non-alphanumeric characters (spaces, underscores, hyphens, slashes,
// parentheses) to a single underscore. This makes the lookup tolerant of casing
// and spacing drift, and — because "Completed 12th" folds to the same shape as
// the code "completed_12th" — it lets us accept either the code OR the human
// label as input without maintaining a second table.
const fold = (s: string) =>
  s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

// Build a folded-key → canonical-label index that accepts both the code and the
// label for each entry.
function buildIndex(codeToLabel: Record<string, string>): Map<string, string> {
  const index = new Map<string, string>()
  for (const [code, label] of Object.entries(codeToLabel)) {
    index.set(fold(code), label)
    index.set(fold(label), label)
  }
  return index
}

const EDU_INDEX = buildIndex(MARKETING_EDU_CODE_TO_LABEL)
const REFERRAL_INDEX = buildIndex(MARKETING_REFERRAL_CODE_TO_LABEL)

// Resolve a raw marketing value to a canonical Pulse label. Unknown non-empty
// values return '' (so we never store a raw code, and ambiguous values like a
// bare "Completed" stay blank for the learner to fill) — but we log them so
// silent drift between the two repos becomes visible instead of vanishing.
function resolve(
  index: Map<string, string>,
  raw: string | null | undefined,
  field: string,
): string {
  const value = raw?.trim()
  if (!value) return ''
  const hit = index.get(fold(value))
  if (hit) return hit
  console.warn(`[marketingFields] unmapped ${field} value: ${JSON.stringify(raw)}`)
  return ''
}

export function mapMarketingEducation(code: string | null | undefined): string {
  return resolve(EDU_INDEX, code, 'educational_status')
}

export function mapMarketingReferral(code: string | null | undefined): string {
  return resolve(REFERRAL_INDEX, code, 'referral_source')
}

// Canonicalize a stored value to its display label for any surface that shows
// these fields (Website hits, Prospects, Analytics). Unlike map*() above, this
// never warns and falls back to the original trimmed value on a miss, so
// free-text answers (e.g. "MBA", "Diploma in computer engineering") survive
// instead of vanishing. Returns null for empty input. Accepts codes OR labels,
// so it's idempotent on already-canonical prospect values.
function canonicalize(index: Map<string, string>, raw: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  return index.get(fold(value)) ?? value
}

export const canonicalReferral = (v: string | null | undefined) => canonicalize(REFERRAL_INDEX, v)
export const canonicalEducation = (v: string | null | undefined) => canonicalize(EDU_INDEX, v)

export const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '')
