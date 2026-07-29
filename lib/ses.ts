// SES (socio-economic) need score for challenge review.
//
// Each intake question maps a chosen option to a fixed 0–4 score (the rubric,
// signed off by the team — see the score tables). A question's contribution =
// option score × its WEIGHT. The SES score = sum over answered questions. HIGHER
// score = MORE need. A candidate passes the SES gate when their score ≥ the
// editable cutoff.
//
// The option→score mapping is FIXED here (source of truth for both scoring and
// the rubric display). Only the per-question weights + the cutoff are editable
// (stored in challenge_review_config; see the Edit-rules SES tab).
//
// Option letters do NOT always follow score order (e.g. social category is
// a.SC b.ST c.OBC d.General but scores General=1…ST=4), so every option is keyed
// by its exact SensAI letter. "Prefer not to say" is scored as the AVERAGE of the
// question's other options (neutral — neither least- nor most-needy). Gender is
// intentionally omitted (not asked in the challenge).

// "Prefer not to say" is scored as 1 (lowest need) on every question that offers it
// (gender, marital, social category, family situation).
export const PNS_SCORE = 1

export type SesOption = { letter: string; label: string; score: number }

export type SesQuestion = {
  key: string
  rawField: string // the metric_raw_rows dimension key
  label: string
  defaultWeight: number
  options: SesOption[]
  pnsLetter?: string // scored as the average of the other options
  variant?: 'familySize' | 'multiSelect' | 'numericRange'
  activeForScoring?: boolean
}

export const SES_RUBRIC: SesQuestion[] = [
  {
    // Q34016: a=Female b=Male c=Transgender d=Prefer not to say (scored as the average).
    // "Place you come from" is dropped — home location already covers it.
    key: 'gender', rawField: 'gender_raw', label: 'Gender', defaultWeight: 5, pnsLetter: 'd',
    options: [
      { letter: 'a', label: 'Female', score: 3 },
      { letter: 'b', label: 'Male', score: 2 },
      { letter: 'c', label: 'Transgender', score: 4 },
    ],
  },
  {
    key: 'marital', rawField: 'marital_raw', label: 'Marital status', defaultWeight: 3, pnsLetter: 'e',
    options: [{ letter: 'a', label: 'Married', score: 1 }, { letter: 'b', label: 'Unmarried', score: 2 }, { letter: 'c', label: 'Divorced / Separated', score: 3 }, { letter: 'd', label: 'Widowed', score: 4 }],
  },
  {
    key: 'social_category', rawField: 'social_category_raw', label: 'Social category', defaultWeight: 5, pnsLetter: 'e',
    options: [{ letter: 'a', label: 'SC', score: 3 }, { letter: 'b', label: 'ST', score: 4 }, { letter: 'c', label: 'OBC', score: 2 }, { letter: 'd', label: 'General', score: 1 }],
  },
  {
    key: 'parent_education', rawField: 'parent_education_raw', label: "Parent/guardian's highest education", defaultWeight: 4,
    options: [{ letter: 'a', label: 'Graduation or above', score: 1 }, { letter: 'b', label: 'Class 12 / Diploma', score: 2 }, { letter: 'c', label: 'Class 10 or below', score: 3 }, { letter: 'd', label: 'No formal education', score: 4 }],
  },
  {
    key: 'family_situation', rawField: 'family_situation_raw', label: 'Family situation', defaultWeight: 4, pnsLetter: 'e',
    options: [{ letter: 'a', label: 'Both parents present', score: 1 }, { letter: 'b', label: 'Single-parent household', score: 2 }, { letter: 'c', label: 'Guardian / relative supporting', score: 3 }, { letter: 'd', label: 'No parent/guardian support', score: 4 }],
  },
  {
    key: 'health', rawField: 'health_raw', label: 'Family health condition', defaultWeight: 3,
    options: [{ letter: 'a', label: 'No major condition', score: 1 }, { letter: 'b', label: 'Present but manageable', score: 2 }, { letter: 'c', label: 'Some pressure', score: 3 }, { letter: 'd', label: 'Major impact', score: 4 }],
  },
  {
    key: 'house_ownership', rawField: 'house_ownership_raw', label: 'House ownership', defaultWeight: 2,
    options: [{ letter: 'a', label: 'Owned', score: 1 }, { letter: 'b', label: 'Rented', score: 2 }, { letter: 'c', label: 'Company / govt / hostel', score: 3 }, { letter: 'd', label: 'With relatives, no rent', score: 4 }, { letter: 'e', label: 'Other', score: 1 }],
  },
  {
    key: 'house_condition', rawField: 'house_condition_raw', label: 'House condition', defaultWeight: 2,
    options: [{ letter: 'a', label: 'Permanent, good', score: 1 }, { letter: 'b', label: 'Permanent, some issues', score: 2 }, { letter: 'c', label: 'Partial / temporary', score: 3 }, { letter: 'd', label: 'Unstable / unsafe', score: 4 }],
  },
  {
    key: 'home_location', rawField: 'home_location_raw', label: 'Home location', defaultWeight: 3,
    options: [{ letter: 'a', label: 'Metro / large city', score: 1 }, { letter: 'b', label: 'City / district HQ', score: 2 }, { letter: 'c', label: 'Town / small town / village', score: 3 }, { letter: 'd', label: 'Remote village', score: 4 }],
  },
  {
    key: 'loan_formal', rawField: 'loan_formal_raw', label: 'Formal loans (bank / MFI)', defaultWeight: 3,
    options: [{ letter: 'a', label: 'No formal loans', score: 0 }, { letter: 'b', label: '< ₹50k', score: 1 }, { letter: 'c', label: '₹50k–1.5L', score: 2 }, { letter: 'd', label: '₹1.5L–3L', score: 3 }, { letter: 'e', label: '> ₹3L', score: 4 }],
  },
  {
    key: 'loan_informal', rawField: 'loan_informal_raw', label: 'Informal loans (relative / moneylender / chit)', defaultWeight: 5,
    options: [{ letter: 'a', label: 'No loan', score: 0 }, { letter: 'b', label: '< ₹50k', score: 1 }, { letter: 'c', label: '₹50k–1.5L', score: 2 }, { letter: 'd', label: '₹1.5L–3L', score: 3 }, { letter: 'e', label: '> ₹3L', score: 4 }],
  },
  {
    key: 'assets', rawField: 'assets_raw', label: 'Family assets', defaultWeight: 2, variant: 'multiSelect',
    options: [{ letter: 'a', label: 'Insurance', score: 1 }, { letter: 'b', label: 'Gold', score: 2 }, { letter: 'c', label: 'FD / savings', score: 3 }, { letter: 'd', label: 'None of the above', score: 4 }],
  },
]

export type SesWeights = Record<string, number>

export type SesAnswerSource =
  | 'per_capita_income'
  | 'gender' | 'marital' | 'social_category' | 'parent_education'
  | 'family_situation' | 'health' | 'house_ownership' | 'house_condition'
  | 'home_location' | 'loan_formal' | 'loan_informal' | 'assets'

export const SES_SOURCE_CATALOG: { key: SesAnswerSource; label: string }[] = [
  { key: 'per_capita_income', label: 'Per-capita income (family income ÷ family size)' },
  ...SES_RUBRIC.map((q) => ({ key: q.key as SesAnswerSource, label: q.label })),
]

const PER_CAPITA_DEFAULT_OPTIONS: Record<string, string> = {
  '0': 'Above ₹2,00,000', '1': '₹1,50,001–₹2,00,000', '2': '₹1,00,001–₹1,50,000',
  '3': '₹50,001–₹1,00,000', '4': 'Up to ₹50,000',
}

export function defaultOptionLabelsForSource(source: SesAnswerSource): Record<string, string> {
  if (source === 'per_capita_income') return { ...PER_CAPITA_DEFAULT_OPTIONS }
  const q = SES_RUBRIC.find((item) => item.key === source)
  return Object.fromEntries([0, 1, 2, 3, 4].map((score) => [
    String(score), q?.options.find((o) => o.score === score)?.label ?? `Option ${score}`,
  ]))
}

export function updateSesQuestionLabel(q: SesQuestionConfig, label: string): SesQuestionConfig {
  if (!q.key.startsWith('ses_custom_') || label.trim()) return { ...q, label }
  return {
    ...q,
    label,
    answerSource: undefined,
    optionLabels: { '0': '0', '1': '1', '2': '2', '3': '3', '4': '4' },
  }
}

export type SesQuestionConfig = {
  key: string
  label: string
  /** Admin-authored display/answer label for each fixed numeric score. */
  optionLabels?: Record<string, string>
  /** Candidate-data source for admin-added rules. Existing built-in rules use their fixed mapping. */
  answerSource?: SesAnswerSource
}

/** Preserve custom per-capita rules saved before answerSource was introduced. */
export function sesAnswerSource(q: SesQuestionConfig): SesQuestionConfig['answerSource'] {
  if (q.answerSource) return q.answerSource
  const label = q.label.toLowerCase().replace(/[^a-z]+/g, ' ').trim()
  return label.includes('per capita income') ? 'per_capita_income' : undefined
}

/** Apply admin-authored labels/order and append new 0–4 SES questions. */
export function configuredSesRubric(config?: SesQuestionConfig[]): SesQuestion[] {
  if (!config?.length) return SES_RUBRIC
  const defaults = new Map(SES_RUBRIC.map((q) => [q.key, q]))
  return config.map(({ key, label, optionLabels, answerSource: savedAnswerSource }) => {
    const existing = defaults.get(key)
    const answerSource = sesAnswerSource({ key, label, optionLabels, answerSource: savedAnswerSource })
    const sourceQuestion = answerSource && answerSource !== 'per_capita_income'
      ? defaults.get(answerSource)
      : undefined
    const question: SesQuestion = existing ? { ...existing, label } : sourceQuestion ? {
      ...sourceQuestion,
      key,
      label,
      defaultWeight: 1,
      activeForScoring: true,
    } : {
      key,
      rawField: answerSource === 'per_capita_income' ? 'per_capita_income_raw' : `${key}_raw`,
      label,
      defaultWeight: 1,
      variant: answerSource === 'per_capita_income' ? 'numericRange' : undefined,
      activeForScoring: answerSource != null,
      options: [0, 1, 2, 3, 4].map((score) => ({
        letter: String.fromCharCode(97 + score), label: String(score), score,
      })),
    }
    if (!optionLabels) return question
    return {
      ...question,
      options: question.options.map((option) => ({
        ...option,
        label: optionLabels[String(option.score)]?.trim() || option.label,
      })),
    }
  })
}

export function effectiveWeight(q: SesQuestion, weights?: SesWeights): number {
  const w = weights?.[q.key]
  return typeof w === 'number' && Number.isFinite(w) ? w : q.defaultWeight
}

/** Max possible weighted score (all questions at their top option), given weights. */
export function sesMaxScore(weights?: SesWeights, questions?: SesQuestionConfig[]): number {
  return configuredSesRubric(questions).filter((q) => q.activeForScoring !== false).reduce((s, q) => s + Math.max(...q.options.map((o) => o.score)) * effectiveWeight(q, weights), 0)
}

const norm = (v: string | null | undefined) => (v ?? '').toString().trim().toLowerCase().replace(/[.。]+$/, '')

function moneyValues(label: string): number[] {
  return [...label.toLowerCase().replaceAll(',', '').matchAll(/(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|l|k)?/g)]
    .map((m) => Number(m[1]) * (m[2]?.startsWith('l') ? 100_000 : m[2] === 'k' ? 1_000 : 1))
    .filter(Number.isFinite)
}

export function numericRangeMatches(label: string, value: number): boolean {
  const values = moneyValues(label)
  if (!values.length) return false
  const text = label.toLowerCase()
  if (values.length >= 2) return value >= Math.min(values[0], values[1]) && value <= Math.max(values[0], values[1])
  if (/above|over|more than|>/.test(text)) return value > values[0]
  if (/below|under|less than|up to|upto|<=|≤|</.test(text)) return value <= values[0]
  return value === values[0]
}

export function isNumericRangeLabel(label: string): boolean {
  const values = moneyValues(label)
  return values.length >= 2 || (values.length === 1 && /above|over|more than|below|under|less than|up to|upto|[<>≤]/i.test(label))
}

type IntegerRange = { min: number; max: number }

/** The whole-rupee interval matched by a numeric range label. */
function numericIntegerRange(label: string): IntegerRange | null {
  const values = moneyValues(label)
  if (!values.length) return null
  if (values.length >= 2) return {
    min: Math.ceil(Math.min(values[0], values[1])),
    max: Math.floor(Math.max(values[0], values[1])),
  }

  const text = label.toLowerCase()
  if (/above|over|more than|>/.test(text)) return { min: Math.floor(values[0]) + 1, max: Infinity }
  // Keep this consistent with numericRangeMatches: all lower-bound wording is inclusive.
  if (/below|under|less than|up to|upto|<=|≤|</.test(text)) return { min: 0, max: Math.floor(values[0]) }
  return null
}

/**
 * Validate score 0..4 as descending income bands that cover every non-negative
 * whole-rupee value exactly once. Per-capita income is rounded before scoring.
 */
export function perCapitaRangesFormPartition(optionLabels: Record<string, string>): boolean {
  const ranges = [0, 1, 2, 3, 4].map((score) => numericIntegerRange(optionLabels[String(score)] ?? ''))
  if (ranges.some((range) => range == null || range.min > range.max)) return false

  const validRanges = ranges as IntegerRange[]
  const [highest, ...rest] = validRanges
  if (highest.max !== Infinity || validRanges.at(-1)?.min !== 0) return false
  return rest.every((range, index) => validRanges[index]!.min === range.max + 1)
}

// The chosen option's base (unweighted) score + a human-readable label for a raw
// answer to one question, or null if unanswered / unrecognised.
export function resolveAnswer(q: SesQuestion, raw: string | null | undefined): { score: number; label: string } | null {
  const s = norm(raw)
  if (!s) return null

  if (q.variant === 'numericRange') {
    const value = Number(s.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(value)) return null
    const opt = q.options.find((o) => numericRangeMatches(o.label, value))
    return opt ? { score: opt.score, label: `₹${value.toLocaleString('en-IN')}/yr (${opt.label})` } : null
  }

  if (q.variant === 'familySize') {
    const n = Number(s.match(/\d+/)?.[0])
    if (!Number.isFinite(n) || n < 1) return null
    const score = n < 2 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4
    const band = q.options.find((o) => o.score === score)?.label ?? String(n)
    return { score, label: `${band} (${n})` }
  }

  if (q.variant === 'multiSelect') {
    // "choose all that apply" — one or more letters. Best asset held = lowest need.
    const letters = s.split(/[^a-z]+/).filter(Boolean)
    const opts = letters.map((l) => q.options.find((o) => o.letter === l)).filter((o): o is SesOption => o != null)
    if (!opts.length) return null
    return { score: Math.min(...opts.map((o) => o.score)), label: opts.map((o) => o.label).join(', ') }
  }

  // Single-letter option.
  const letter = /^[a-z]$/.test(s) ? s : null
  if (!letter) return null
  if (q.pnsLetter && letter === q.pnsLetter) {
    // Prefer-not-to-say scores as PNS_SCORE (lowest-need) across all PNS questions.
    return { score: PNS_SCORE, label: 'Prefer not to say' }
  }
  const opt = q.options.find((o) => o.letter === letter)
  return opt ? { score: opt.score, label: opt.label } : null
}

/** The base (unweighted) option score for a raw answer, or null. */
export function optionScore(q: SesQuestion, raw: string | null | undefined): number | null {
  return resolveAnswer(q, raw)?.score ?? null
}

export type SesBreakdownRow = { key: string; label: string; answer: string; optionScore: number; weight: number; contribution: number }

export type SesResult = {
  score: number
  maxScore: number
  answered: number
  total: number
  breakdown: SesBreakdownRow[]
}

/** Weighted SES score from a map of rawField → raw answer. */
export function computeSes(raw: Record<string, string | null | undefined>, weights?: SesWeights, questions?: SesQuestionConfig[]): SesResult {
  const breakdown: SesResult['breakdown'] = []
  let score = 0
  let answered = 0
  const rubric = configuredSesRubric(questions)
  for (const q of rubric) {
    if (q.activeForScoring === false) continue
    const ans = resolveAnswer(q, raw[q.rawField])
    if (ans == null) continue
    const weight = effectiveWeight(q, weights)
    const contribution = ans.score * weight
    score += contribution
    answered++
    breakdown.push({ key: q.key, label: q.label, answer: ans.label, optionScore: ans.score, weight, contribution })
  }
  return { score: Math.round(score * 10) / 10, maxScore: sesMaxScore(weights, questions), answered, total: rubric.length, breakdown }
}
