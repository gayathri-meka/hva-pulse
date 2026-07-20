'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireStaff, getAppUser } from '@/lib/auth'
import { normEmail } from '@/lib/interviews'
import {
  computeInterviewReviewRow,
  type InterviewLite,
  type InterviewReviewRow,
  type Recommendation,
} from '@/lib/interviewReview'

// The interview Review tab: the team's per-candidate release gates after each
// round. Staff-gated. Candidate booking is driven off interview_decisions
// (see getBookingState). Recording a decision here IS the release.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Ok = { ok: true }
type Err = { ok: false; error: string }

export type ReviewRoundCell = {
  status: InterviewReviewRow['round1']['status']
  recommendation: Recommendation | null
  interviewId: string | null
  interviewerName: string | null
}
export type InterviewReviewTableRow = {
  email: string
  name: string | null
  round1: ReviewRoundCell
  round2: ReviewRoundCell
  stage: InterviewReviewRow['stage']
  stage1: InterviewReviewRow['stage1']
  final: InterviewReviewRow['final']
  canReleaseStage1: boolean
  canReleaseFinal: boolean
}

/** Everything the Review tab renders: one row per challenge-selected+released
 *  candidate, with their per-round interview status/recommendation and stage. */
export async function getInterviewReview(): Promise<InterviewReviewTableRow[]> {
  await requireStaff()
  const a = admin()

  // Candidates in the interview pipeline = released 'selected' challenge decisions.
  const { data: decRows } = await a
    .from('challenge_decisions')
    .select('email')
    .eq('final_decision', 'selected')
    .not('published_at', 'is', null)
  const emails = [...new Set((decRows ?? []).map((d) => normEmail(d.email as string)))]
  if (!emails.length) return []

  const [{ data: ivRows }, { data: idRows }, { data: prospects }] = await Promise.all([
    a.from('interviews').select('id, candidate_email, round, status, recommendation, interviewer_email').in('candidate_email', emails),
    a.from('interview_decisions').select('candidate_email, stage1, final').in('candidate_email', emails),
    a.from('prospects').select('email, name').in('email', emails),
  ])

  // Interviewer names for whoever conducted a round.
  const ivrEmails = [...new Set((ivRows ?? []).map((r) => r.interviewer_email as string))]
  const ivrName = new Map<string, string | null>()
  if (ivrEmails.length) {
    const { data } = await a.from('users').select('email, name').in('email', ivrEmails)
    for (const u of data ?? []) ivrName.set(u.email, (u.name as string | null) ?? null)
  }

  const nameByEmail = new Map((prospects ?? []).map((p) => [p.email, (p.name as string | null) ?? null]))
  const decByEmail = new Map((idRows ?? []).map((d) => [normEmail(d.candidate_email as string), d]))
  const ivByEmail = new Map<string, typeof ivRows>()
  for (const r of ivRows ?? []) {
    const e = normEmail(r.candidate_email as string)
    const list = ivByEmail.get(e) ?? []
    list.push(r)
    ivByEmail.set(e, list)
  }

  return emails.map((email) => {
    const ivs = ivByEmail.get(email) ?? []
    const lite: InterviewLite[] = ivs.map((r) => ({ round: r.round as 1 | 2, status: r.status, recommendation: r.recommendation ?? null }))
    const dec = decByEmail.get(email)
    const computed = computeInterviewReviewRow(lite, { stage1: dec?.stage1 ?? null, final: dec?.final ?? null })

    const cell = (round: 1 | 2): ReviewRoundCell => {
      const iv = ivs.find((r) => r.round === round && r.status !== 'cancelled')
      const info = round === 1 ? computed.round1 : computed.round2
      return {
        status: info.status,
        recommendation: info.recommendation,
        interviewId: (iv?.id as string) ?? null,
        interviewerName: iv ? ivrName.get(iv.interviewer_email as string) ?? null : null,
      }
    }

    return {
      email,
      name: nameByEmail.get(email) ?? null,
      round1: cell(1),
      round2: cell(2),
      stage: computed.stage,
      stage1: computed.stage1,
      final: computed.final,
      canReleaseStage1: computed.canReleaseStage1,
      canReleaseFinal: computed.canReleaseFinal,
    }
  })
}

/** Release a decision at a gate. gate 'stage1' → advance|rejected (advance unlocks
 *  Round 2 booking); gate 'final' → selected|rejected. Recording IS the release. */
export async function setInterviewDecision(input: {
  email: string
  gate: 'stage1' | 'final'
  decision: 'advance' | 'rejected' | 'selected'
  reason?: string
}): Promise<Ok | Err> {
  await requireStaff()
  const staff = await getAppUser()
  const email = normEmail(input.email)
  const a = admin()

  const valid =
    input.gate === 'stage1'
      ? input.decision === 'advance' || input.decision === 'rejected'
      : input.decision === 'selected' || input.decision === 'rejected'
  if (!valid) return { ok: false, error: 'Invalid decision for this gate.' }

  // Guard against releasing out of order (round not done, or gate already decided).
  const [{ data: ivRows }, { data: dec }] = await Promise.all([
    a.from('interviews').select('round, status, recommendation').eq('candidate_email', email),
    a.from('interview_decisions').select('stage1, final').eq('candidate_email', email).maybeSingle(),
  ])
  const lite: InterviewLite[] = (ivRows ?? []).map((r) => ({ round: r.round as 1 | 2, status: r.status, recommendation: r.recommendation ?? null }))
  const row = computeInterviewReviewRow(lite, { stage1: dec?.stage1 ?? null, final: dec?.final ?? null })
  if (input.gate === 'stage1' && !row.canReleaseStage1)
    return { ok: false, error: 'Round 1 must be completed and undecided to release a Round-1 decision.' }
  if (input.gate === 'final' && !row.canReleaseFinal)
    return { ok: false, error: 'Round 2 must be completed (after advancing) to make the final call.' }

  const now = new Date().toISOString()
  const patch =
    input.gate === 'stage1'
      ? { stage1: input.decision, stage1_reason: input.reason?.trim() || null, stage1_released_at: now }
      : { final: input.decision, final_reason: input.reason?.trim() || null, final_released_at: now }

  const { error } = await a
    .from('interview_decisions')
    .upsert({ candidate_email: email, ...patch, decided_by: staff?.email ?? null, updated_at: now }, { onConflict: 'candidate_email' })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admissions/interviews/review')
  revalidatePath('/candidate/interview')
  revalidatePath('/candidate/selection')
  return { ok: true }
}

/** Undo a released decision at a gate → back to undecided. */
export async function undoInterviewDecision(input: { email: string; gate: 'stage1' | 'final' }): Promise<Ok | Err> {
  await requireStaff()
  const email = normEmail(input.email)
  const patch =
    input.gate === 'stage1'
      ? { stage1: null, stage1_reason: null, stage1_released_at: null }
      : { final: null, final_reason: null, final_released_at: null }
  const { error } = await admin()
    .from('interview_decisions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('candidate_email', email)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews/review')
  revalidatePath('/candidate/interview')
  revalidatePath('/candidate/selection')
  return { ok: true }
}
