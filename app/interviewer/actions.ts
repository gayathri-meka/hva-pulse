'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireInterviewer } from '@/lib/auth'
import { validateNewSlot, normEmail, type InterviewSlot, type Interview } from '@/lib/interviews'

// Interviewer-facing scheduling ops. Interviewers are authed Pulse users (role
// 'interviewer'); interview_slots/interviews are staff-only under RLS, so reads +
// writes go through the service-role client filtered to the authed interviewer.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Ok<T> = { ok: true; data: T }
type Err = { ok: false; error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toSlot(r: any): InterviewSlot {
  return { id: r.id, interviewerEmail: r.interviewer_email, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInterview(r: any): Interview {
  return {
    id: r.id,
    candidateEmail: r.candidate_email,
    round: r.round,
    slotId: r.slot_id,
    interviewerEmail: r.interviewer_email,
    scheduledAt: r.scheduled_at,
    status: r.status,
    meetLink: r.meet_link ?? null,
  }
}

/** Publish a new availability slot into the shared pool. */
export async function publishSlot(input: { startsAt: string; endsAt: string }): Promise<Ok<InterviewSlot> | Err> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)

  const { data: existing } = await admin()
    .from('interview_slots')
    .select('starts_at, ends_at')
    .eq('interviewer_email', email)
    .neq('status', 'blocked')
  const valid = validateNewSlot(
    input,
    (existing ?? []).map((s) => ({ startsAt: s.starts_at, endsAt: s.ends_at })),
    new Date(),
  )
  if (!valid.ok) return valid

  const { data, error } = await admin()
    .from('interview_slots')
    .insert({ interviewer_email: email, starts_at: input.startsAt, ends_at: input.endsAt, status: 'open' })
    .select('id, interviewer_email, starts_at, ends_at, status')
    .single()
  if (error) return { ok: false, error: error.message }
  revalidatePath('/interviewer')
  return { ok: true, data: toSlot(data) }
}

/** Remove an OPEN slot (a booked slot can't be deleted — cancel the interview first). */
export async function deleteSlot(slotId: string): Promise<Ok<null> | Err> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)
  const { data, error } = await admin()
    .from('interview_slots')
    .delete()
    .eq('id', slotId)
    .eq('interviewer_email', email)
    .eq('status', 'open')
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: 'That slot is booked or no longer open.' }
  revalidatePath('/interviewer')
  return { ok: true, data: null }
}

/** Record the outcome of an interview the interviewer conducted. */
export async function setInterviewOutcome(
  interviewId: string,
  outcome: 'completed' | 'no_show',
): Promise<Ok<null> | Err> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)
  const { data, error } = await admin()
    .from('interviews')
    .update({ status: outcome, updated_at: new Date().toISOString() })
    .eq('id', interviewId)
    .eq('interviewer_email', email)
    .in('status', ['booked', 'confirmed'])
    .select('id')
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: 'Interview not found or already closed.' }
  revalidatePath('/interviewer')
  return { ok: true, data: null }
}

/** This interviewer's own slots + interviews, for the portal. */
export async function getMySchedule(): Promise<{ slots: InterviewSlot[]; interviews: Interview[] }> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)
  const [slotsRes, interviewsRes] = await Promise.all([
    admin().from('interview_slots').select('*').eq('interviewer_email', email).order('starts_at'),
    admin().from('interviews').select('*').eq('interviewer_email', email).neq('status', 'cancelled').order('scheduled_at'),
  ])
  return {
    slots: (slotsRes.data ?? []).map(toSlot),
    interviews: (interviewsRes.data ?? []).map(toInterview),
  }
}
