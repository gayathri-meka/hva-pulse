// Turns the raw challenge-intake answers (metric_raw_rows.dimensions from the
// pulse_challenge_intake BQ view) into labelled, decoded, grouped fields for the
// interview dossier. Pure + unit-tested — option-letter answers are decoded to
// their meaning; free-text answers pass through; blanks show as "—".

export type IntakeRawDisplay = Record<string, string | null | undefined>
export type IntakeField = { label: string; value: string }
export type IntakeGroup = { group: string; fields: IntakeField[] }

// Option-letter → meaning, per question (verified prompts, course 587, 2026).
const M = {
  working: { a: 'Not working', b: 'Working full-time', c: 'Working part-time', d: 'Doing an internship', e: 'Freelancing', f: 'Other' },
  domain: { a: 'Tech', b: 'Non-tech', c: 'Not applicable' },
  willing: { a: 'Yes', b: 'No', c: 'Not sure yet', d: 'Not applicable' },
  time: { a: 'Less than 1 hour/day', b: '1–2 hours/day', c: '2–4 hours/day', d: 'More than 4 hours/day' },
  yesno: { a: 'Yes', b: 'No', c: 'Not sure', d: 'Not applicable' },
  placement: { a: 'Very good', b: 'Good', c: 'Average', d: 'Limited', e: 'Very limited', f: "Doesn't know" },
  otherCourse: { a: 'No other training', b: 'Yes — currently doing another', c: 'Yes — planning to' },
  relocate: { a: 'Yes, ready to relocate', b: 'No, not ready', c: 'Not sure yet' },
  nonTech: { a: 'Yes, open to non-tech', b: 'No, tech only', c: 'Not sure' },
  urgency: { a: 'Immediately', b: 'Within 3 months', c: 'Within 6 months', d: 'After 1 year', e: 'Not urgent' },
  applying: { a: 'Yes, actively', b: 'Yes, occasionally', c: 'No — will apply after 6 months', d: 'No, not right now', e: 'No' },
  courseType: { a: 'Full-time', b: 'Part-time', c: 'Distance', d: 'Online' },
} as const

type OptMap = Record<string, string>

/** Decode an answer: a leading option letter → its meaning, otherwise the raw text. */
export function decodeAnswer(raw: string | null | undefined, map?: OptMap): string {
  const t = (raw ?? '').toString().trim()
  if (!t) return '—'
  if (!map) return t
  // leading single option letter: "b", "b.", "b)", "(b)", "b - ..." → letter
  const letter = t.match(/^\(?([a-f])[).\-\s]/i)?.[1]?.toLowerCase() ?? (/^[a-f]$/i.test(t) ? t.toLowerCase() : null)
  return (letter && map[letter]) || t
}

// Ordered field definitions per group. `map` present → decode as an option.
const GROUPS: { group: string; fields: { label: string; key: string; map?: OptMap }[] }[] = [
  {
    group: 'About',
    fields: [{ label: 'Preferred name', key: 'preferred_name_raw' }],
  },
  {
    group: 'Motivation',
    fields: [
      { label: 'Why join HVA', key: 'why_hva_raw' },
      { label: 'Why web development', key: 'why_webdev_raw' },
    ],
  },
  {
    group: 'Family & finances',
    fields: [
      { label: 'People in family', key: 'family_size_raw' },
      { label: 'Earning members', key: 'earning_members_raw' },
      { label: 'Annual family income', key: 'family_income_raw' },
      { label: 'Monthly family income', key: 'monthly_income_raw' },
    ],
  },
  {
    group: 'Work now',
    fields: [
      { label: 'Currently working', key: 'working_raw', map: M.working },
      { label: 'Work domain', key: 'work_domain_raw', map: M.domain },
      { label: 'Company / org', key: 'company_raw' },
      { label: 'Current salary/stipend', key: 'salary_raw' },
      { label: 'Willing to pause/leave work', key: 'willing_raw', map: M.willing },
    ],
  },
  {
    group: 'Availability & commitment',
    fields: [
      { label: 'Time per day', key: 'time_per_day_raw', map: M.time },
      { label: 'Commitments to Mar 2027', key: 'commitments_raw' },
      { label: '6-month availability (Sep–Mar)', key: 'availability_raw' },
      { label: 'Internship before Mar 2027', key: 'internship_raw', map: M.yesno },
      { label: 'Other course/training', key: 'other_course_raw', map: M.otherCourse },
      { label: 'Other training details', key: 'other_course_detail_raw' },
    ],
  },
  {
    group: 'Jobs & placement',
    fields: [
      { label: 'Applying for jobs', key: 'applying_raw', map: M.applying },
      { label: 'How urgently needs a job', key: 'urgency_raw', map: M.urgency },
      { label: 'Min salary expectation', key: 'min_salary_raw' },
      { label: 'Open to non-tech (after 2 mo)', key: 'non_tech_raw', map: M.nonTech },
      { label: 'Ready to relocate to metro', key: 'relocate_raw', map: M.relocate },
      { label: 'College placement opportunities', key: 'placement_raw', map: M.placement },
    ],
  },
]

/** Build the grouped, decoded intake fields for the dossier. Returns [] if no data. */
export function intakeDossierFields(raw: IntakeRawDisplay | null | undefined): IntakeGroup[] {
  if (!raw || Object.keys(raw).length === 0) return []
  return GROUPS.map((g) => ({
    group: g.group,
    fields: g.fields.map((f) => ({ label: f.label, value: decodeAnswer(raw[f.key], f.map) })),
  }))
}
