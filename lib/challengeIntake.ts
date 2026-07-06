// Parses the raw challenge-intake answers (from the pulse_challenge_intake BQ view,
// synced into metric_raw_rows) into the structured eligibility signals the review
// engine scores. Kept pure + unit-tested because the raw answers are messy: option
// letters, free-text salaries ("10k", "₹8,000 per month", "no income"), stray junk.
//
// Anything we can't confidently parse is left undefined → the corresponding
// criterion evaluates to 'na' (manual review), never an auto-elimination.
//
// college_name is intentionally NOT turned into a tier here — tier classification
// needs a Tier 1/2 list we don't have yet, so collegeTier stays a placeholder.

import type { CandidateSignals } from './challengeReview'

// Raw answer columns as they arrive in metric_raw_rows.dimensions (all strings).
export type IntakeRaw = {
  studying_raw?: string | null
  level_raw?: string | null
  college_name?: string | null
  grad_year_raw?: string | null
  work_domain_raw?: string | null
  salary_raw?: string | null
  willing_raw?: string | null
}

// The subset of signals derived from intake (collegeTier excluded — placeholder).
type IntakeSignals = Pick<
  CandidateSignals,
  'graduationYear' | 'studyMode' | 'working' | 'willingToQuit' | 'monthlySalaryInr'
>

const norm = (v: string | null | undefined) =>
  (v ?? '').toString().trim().toLowerCase().replace(/[.。]+$/, '')

// No answer at all (never responded) — distinct from an explicit "Not Applicable".
const isBlank = (v: string | null | undefined) => norm(v) === ''

// An explicit "Not Applicable"-style answer (the person chose it), NOT a blank.
const isNA = (v: string | null | undefined) => {
  const s = norm(v)
  return s === 'na' || s === 'n/a' || s === 'not applicable' || s === 'nil' || s === 'none'
}

// Reduce an answer to a single option letter a–f. Accepts a bare letter, or maps
// common free-text answers back to their option.
function optionLetter(v: string | null | undefined, textMap: Record<string, string> = {}): string | undefined {
  const s = norm(v)
  if (/^[a-f]$/.test(s)) return s
  if (s in textMap) return textMap[s]
  return undefined
}

// "Are you currently studying?" 34069 → a=Yes b=No.
function parseStudying(v: string | null | undefined): boolean | undefined {
  const l = optionLetter(v, { yes: 'a', no: 'b' })
  return l === 'a' ? true : l === 'b' ? false : undefined
}

// Work domain 34084 → a=Tech b=Non-tech c=NA. Working = answered a real domain.
function parseWorking(v: string | null | undefined): boolean | undefined {
  if (isBlank(v)) return undefined // never answered → unknown
  const l = optionLetter(v, { tech: 'a', 'non-tech': 'b', 'non tech': 'b', 'not applicable': 'c' })
  if (l === 'a' || l === 'b') return true
  if (l === 'c') return false
  if (isNA(v)) return false
  return undefined
}

// Willingness 34086 → a=Yes b=No c=Not sure d=NA.
function parseWilling(v: string | null | undefined): boolean | undefined {
  const l = optionLetter(v, { yes: 'a', no: 'b', 'not sure': 'c', 'not sure yet': 'c', 'not applicable': 'd' })
  if (l === 'a') return true
  if (l === 'b') return false
  return undefined // c (not sure) / d (NA) / unknown → let the criterion decide
}

// Year of completion 34074 → first plausible 20xx year, else undefined.
function parseYear(v: string | null | undefined): number | undefined {
  if (isNA(v)) return undefined
  const m = norm(v).match(/\b(20\d{2})\b/)
  if (!m) return undefined
  const y = Number(m[1])
  return y >= 2000 && y <= 2100 ? y : undefined
}

// Monthly salary 34085 → integer rupees/month, 0 for explicit no-income, else
// undefined if we can't read a number (stray letters, junk).
export function parseSalary(v: string | null | undefined): number | undefined {
  const s = norm(v)
  if (isBlank(v)) return undefined // never answered → unknown, not zero
  if (isNA(v)) return 0
  if (/\b(no|zero)\b.*\bincome\b|^no income$|no fixed income|^0+$/.test(s)) return 0
  // A stray single option letter is not a salary.
  if (/^[a-z]$/.test(s)) return undefined
  // "10k" / "10 k" → 10000.
  const kMatch = s.match(/(\d[\d,]*(?:\.\d+)?)\s*k\b/)
  if (kMatch) {
    const n = Number(kMatch[1].replace(/,/g, ''))
    return Number.isFinite(n) ? Math.round(n * 1000) : undefined
  }
  // Otherwise take the first run of digits (drop ₹, commas, "rs", "per month").
  const digits = s.replace(/[,₹]/g, '').match(/\d+/)
  if (!digits) return undefined
  const n = Number(digits[0])
  return Number.isFinite(n) ? n : undefined
}

export function parseIntake(raw: IntakeRaw): IntakeSignals {
  const studying = parseStudying(raw.studying_raw)
  const working = parseWorking(raw.work_domain_raw)
  const willingToQuit = parseWilling(raw.willing_raw)
  const monthlySalaryInr = parseSalary(raw.salary_raw)

  // Graduation gate only applies to CURRENT students. If not studying, there's no
  // "current education" year to gate on.
  const graduationYear = studying ? parseYear(raw.grad_year_raw) : undefined

  // FT/PT isn't asked — infer per the agreed rule: currently studying AND working
  // → part-time (can proceed); studying and not working → full-time. Unknown work
  // status leaves mode undefined (→ manual review for late-completion cases).
  const studyMode: IntakeSignals['studyMode'] = studying
    ? working === true
      ? 'part_time'
      : working === false
        ? 'full_time'
        : undefined
    : undefined

  return { graduationYear, studyMode, working, willingToQuit, monthlySalaryInr }
}
