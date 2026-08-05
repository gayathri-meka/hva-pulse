'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { getAppUser, requireStaff } from '@/lib/auth'
import { normEmail } from '@/lib/interviews'
import {
  CODING_FIELD_TO_COLUMN,
  CODING_INTERVIEWERS,
  CODING_SCORES,
  type CodingInterviewField,
  type CodingInterviewer,
  type CodingInterviewRow,
  type CodingInterviewStatus,
  type CodingVerdict,
} from '@/lib/codingInterviews'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/** Candidates appear automatically after an Advance verdict in Personal
 * Interviews. A released stage-1 advance is also accepted for compatibility
 * with the existing admissions decision gate. */
export async function getCodingInterviews(): Promise<CodingInterviewRow[]> {
  await requireStaff()
  const a = admin()
  const [{ data: advancedInterviews }, { data: advancedDecisions }] = await Promise.all([
    a.from('interviews').select('candidate_email').eq('round', 1).eq('recommendation', 'advance'),
    a.from('interview_decisions').select('candidate_email').eq('stage1', 'advance'),
  ])
  const emails = [...new Set([
    ...(advancedInterviews ?? []).map((r) => normEmail(r.candidate_email as string)),
    ...(advancedDecisions ?? []).map((r) => normEmail(r.candidate_email as string)),
  ])].filter(Boolean)
  if (!emails.length) return []

  const [{ data: prospects }, { data: records }] = await Promise.all([
    a.from('prospects').select('email, name').in('email', emails),
    a.from('coding_interview_reviews').select('*').in('candidate_email', emails),
  ])
  const nameByEmail = new Map((prospects ?? []).map((r) => [normEmail(r.email as string), (r.name as string | null) ?? null]))
  const recordByEmail = new Map((records ?? []).map((r) => [normEmail(r.candidate_email as string), r]))

  return emails.map((email) => {
    const r = recordByEmail.get(email)
    return {
      email,
      name: nameByEmail.get(email) ?? null,
      interviewStatus: (r?.interview_status as CodingInterviewStatus) ?? 'not_started',
      verdict: (r?.verdict as CodingVerdict | null) ?? null,
      interviewDate: (r?.interview_date as string | null) ?? null,
      interviewTime: (r?.interview_time as string | null)?.slice(0, 5) ?? null,
      preInterviewNotes: (r?.pre_interview_notes as string | null) ?? '',
      interviewer: (r?.interviewer as CodingInterviewer | null) ?? null,
      problemsAsked: (r?.problems_asked as string | null) ?? '',
      codingScore: r?.coding_score == null ? null : Number(r.coding_score),
      readingComprehensionScore: r?.reading_comprehension_score == null ? null : Number(r.reading_comprehension_score),
      learnabilityObservations: (r?.learnability_observations as string | null) ?? '',
      notes: (r?.notes as string | null) ?? '',
      summary: (r?.summary as string | null) ?? '',
    }
  }).sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email))
}

export async function updateCodingInterviewField(input: { email: string; field: CodingInterviewField; value: string | number | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireStaff()
  const user = await getAppUser()
  const email = normEmail(input.email)
  if (!email || !(input.field in CODING_FIELD_TO_COLUMN)) return { ok: false, error: 'Invalid update.' }

  let value = input.value === '' ? null : input.value
  if (input.field === 'interviewStatus' && value !== 'not_started' && value !== 'completed') return { ok: false, error: 'Invalid interview status.' }
  if (input.field === 'verdict' && value !== null && value !== 'selected' && value !== 'rejected') return { ok: false, error: 'Invalid verdict.' }
  if (input.field === 'interviewer' && value !== null && !CODING_INTERVIEWERS.includes(value as CodingInterviewer)) return { ok: false, error: 'Invalid interviewer.' }
  if ((input.field === 'codingScore' || input.field === 'readingComprehensionScore') && value !== null) {
    value = Number(value)
    if (!CODING_SCORES.includes(value as typeof CODING_SCORES[number])) return { ok: false, error: 'Invalid score.' }
  }

  const column = CODING_FIELD_TO_COLUMN[input.field]
  const { error } = await admin().from('coding_interview_reviews').upsert({
    candidate_email: email, [column]: value, updated_at: new Date().toISOString(), updated_by: user?.email ?? null,
  }, { onConflict: 'candidate_email' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/coding-interviews')
  return { ok: true }
}
