'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { nextBookableRound, isSlotBookable, normEmail, roundLabel, type InterviewSlot, type Interview } from '@/lib/interviews'
import { sendBookingEmails } from '@/lib/interviewInvite'
import { createInterviewEvent, deleteInterviewEvent } from '@/lib/googleCalendar'

// Candidate-facing booking. Candidates aren't in the users table — identity is the
// authed Google email; all data access is via the service-role client filtered to
// that email (interview tables are staff-only under RLS).

const SLOT_MS = 60 * 60_000 // each interview slot is 1 hour

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Two 1-hour windows starting at these epoch ms overlap.
function windowsOverlap(aStart: number, bStart: number): boolean {
  return aStart < bStart + SLOT_MS && bStart < aStart + SLOT_MS
}

async function authedCandidateEmail(): Promise<string | null> {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.email ? normEmail(user.email) : null
}

// A candidate may book only once the team has RELEASED a 'selected' decision.
async function isSelectedReleased(email: string): Promise<boolean> {
  const { data } = await admin()
    .from('challenge_decisions')
    .select('final_decision, published_at')
    .eq('email', email)
    .maybeSingle()
  return !!data?.published_at && data.final_decision === 'selected'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSlot = (r: any): InterviewSlot => ({ id: r.id, interviewerEmail: r.interviewer_email, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, round: r.round ?? null })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toInterview = (r: any): Interview => ({ id: r.id, candidateEmail: r.candidate_email, round: r.round, slotId: r.slot_id, interviewerEmail: r.interviewer_email, scheduledAt: r.scheduled_at, status: r.status, meetLink: r.meet_link ?? null })

export type BookingState = {
  eligible: boolean
  interviews: Interview[]
  nextRound: 1 | 2 | null
  openSlots: InterviewSlot[] // only populated when there's a bookable round
  stage1: 'advance' | 'rejected' | null // team's post-Round-1 release
  final: 'selected' | 'rejected' | null // team's post-Round-2 release
  awaitingReview: boolean // a round is done but the team hasn't released a decision
}

/** Everything the candidate booking page needs. */
export async function getBookingState(): Promise<BookingState> {
  const email = await authedCandidateEmail()
  if (!email || !(await isSelectedReleased(email)))
    return { eligible: false, interviews: [], nextRound: null, openSlots: [], stage1: null, final: null, awaitingReview: false }

  const [{ data: ivRows }, { data: decision }] = await Promise.all([
    admin().from('interviews').select('*').eq('candidate_email', email),
    admin().from('interview_decisions').select('stage1, final').eq('candidate_email', email).maybeSingle(),
  ])
  const interviews = (ivRows ?? []).map(toInterview)
  const stage1 = (decision?.stage1 as 'advance' | 'rejected' | null) ?? null
  const final = (decision?.final as 'selected' | 'rejected' | null) ?? null

  // Base sequential round, then apply the team's release gates:
  // Round 2 opens only when 'advance' is released; any rejection / final call closes booking.
  let nextRound = nextBookableRound(interviews)
  if (nextRound === 2 && stage1 !== 'advance') nextRound = null
  if (stage1 === 'rejected' || final != null) nextRound = null

  // "Awaiting review" = a round is finished but no decision is out yet, so there's
  // nothing to book and no rejection — the candidate is waiting on the team.
  const r1Done = interviews.some((i) => i.round === 1 && (i.status === 'completed' || i.status === 'no_show'))
  const r2Done = interviews.some((i) => i.round === 2 && (i.status === 'completed' || i.status === 'no_show'))
  const awaitingReview = (r1Done && stage1 == null) || (stage1 === 'advance' && r2Done && final == null)

  let openSlots: InterviewSlot[] = []
  if (nextRound) {
    const { data: slotRows } = await admin()
      .from('interview_slots')
      .select('*')
      .eq('status', 'open')
      .eq('round', nextRound) // only the panel for the round they're on
      .gt('starts_at', new Date().toISOString())
      .order('starts_at')
    openSlots = (slotRows ?? []).map(toSlot)
    // Round 2 prefers a different interviewer than round 1 (belt-and-braces —
    // the coding panel is already separate from the motivation panel).
    if (nextRound === 2) {
      const r1 = interviews.find((i) => i.round === 1 && i.status !== 'cancelled')
      if (r1) openSlots = openSlots.filter((s) => s.interviewerEmail !== r1.interviewerEmail)
    }
    // Never offer a slot that overlaps one of its interviewer's already-booked
    // interviews (a :30 slot can overlap a :00 booking — that would double-book).
    const { data: activeIvs } = await admin()
      .from('interviews')
      .select('interviewer_email, scheduled_at')
      .in('status', ['booked', 'confirmed'])
    const busy = (activeIvs ?? []).map((i) => ({ email: normEmail(i.interviewer_email), start: new Date(i.scheduled_at).getTime() }))
    openSlots = openSlots.filter((s) => {
      const start = new Date(s.startsAt).getTime()
      return !busy.some((b) => b.email === normEmail(s.interviewerEmail) && windowsOverlap(start, b.start))
    })
  }
  return { eligible: true, interviews, nextRound, openSlots, stage1, final, awaitingReview }
}

/** Book an open slot for the candidate's next round. Auto-confirms. */
export async function bookSlot(slotId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await authedCandidateEmail()
  if (!email) return { ok: false, error: 'Please sign in again.' }
  if (!(await isSelectedReleased(email))) return { ok: false, error: 'You are not eligible to book an interview yet.' }

  const { data: ivRows } = await admin().from('interviews').select('round, status').eq('candidate_email', email)
  const round = nextBookableRound((ivRows ?? []).map((r) => ({ round: r.round, status: r.status })))
  if (!round) return { ok: false, error: 'You have no interview round to book right now.' }

  // Release gates: Round 2 needs a released 'advance'; a rejection / final call closes booking.
  const { data: decision } = await admin().from('interview_decisions').select('stage1, final').eq('candidate_email', email).maybeSingle()
  if (decision?.stage1 === 'rejected' || decision?.final != null)
    return { ok: false, error: 'You are not eligible to book an interview right now.' }
  if (round === 2 && decision?.stage1 !== 'advance')
    return { ok: false, error: 'The coding round isn’t open for you yet.' }

  // Claim the slot atomically: flip open → booked only if still open AND it's for
  // the round the candidate is actually on (a coding slot can't serve round 1, etc.).
  const { data: claimed, error: claimErr } = await admin()
    .from('interview_slots')
    .update({ status: 'booked', updated_at: new Date().toISOString() })
    .eq('id', slotId)
    .eq('status', 'open')
    .eq('round', round)
    .gt('starts_at', new Date().toISOString())
    .select('*')
    .maybeSingle()
  if (claimErr) return { ok: false, error: claimErr.message }
  if (!claimed) return { ok: false, error: 'That slot was just taken. Please pick another.' }
  const slot = toSlot(claimed)

  // Overlap guard: a :30 slot can overlap a :00 booking for the same interviewer.
  // If this slot clashes with one of their active interviews, release it and stop.
  const { data: interviewerIvs } = await admin()
    .from('interviews')
    .select('scheduled_at')
    .eq('interviewer_email', slot.interviewerEmail)
    .in('status', ['booked', 'confirmed'])
  const slotStart = new Date(slot.startsAt).getTime()
  if ((interviewerIvs ?? []).some((i) => windowsOverlap(slotStart, new Date(i.scheduled_at).getTime()))) {
    await admin().from('interview_slots').update({ status: 'open' }).eq('id', slot.id)
    return { ok: false, error: 'That time was just taken. Please pick another.' }
  }

  // Create the confirmed interview. If this fails (e.g. duplicate round), release the slot.
  const { data: created, error: ivErr } = await admin().from('interviews').insert({
    candidate_email: email,
    round,
    slot_id: slot.id,
    interviewer_email: slot.interviewerEmail,
    scheduled_at: slot.startsAt,
    status: 'confirmed',
  }).select('id').single()
  if (ivErr || !created) {
    await admin().from('interview_slots').update({ status: 'open' }).eq('id', slot.id)
    return { ok: false, error: 'Could not complete the booking. Please try again.' }
  }

  const [{ data: prospect }, { data: interviewer }] = await Promise.all([
    admin().from('prospects').select('name').eq('email', email).maybeSingle(),
    admin().from('users').select('name').eq('email', slot.interviewerEmail).maybeSingle(),
  ])

  // Preferred: a Google Calendar invite with a Meet link (academy@ organiser,
  // interviewer + candidate attendees). Google emails everyone automatically.
  const event = await createInterviewEvent({
    candidateEmail: email,
    candidateName: prospect?.name ?? null,
    interviewerEmail: slot.interviewerEmail,
    round,
    roundLabel: roundLabel(round),
    scheduledAt: slot.startsAt,
  })
  if (event) {
    await admin().from('interviews').update({ meet_link: event.meetLink, calendar_event_id: event.eventId }).eq('id', created.id)
  } else {
    // Fallback (calendar not connected yet): plain confirmation email to both.
    await sendBookingEmails({
      candidateEmail: email,
      candidateName: prospect?.name ?? null,
      interviewerEmail: slot.interviewerEmail,
      interviewerName: interviewer?.name ?? null,
      round,
      scheduledAt: slot.startsAt,
    })
  }

  revalidatePath('/candidate/interview')
  return { ok: true }
}

/** Candidate cancels their own upcoming interview (to reschedule). Frees the slot. */
export async function cancelMyInterview(interviewId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = await authedCandidateEmail()
  if (!email) return { ok: false, error: 'Please sign in again.' }

  const { data: iv } = await admin()
    .from('interviews')
    .select('id, slot_id, status, scheduled_at, calendar_event_id')
    .eq('id', interviewId)
    .eq('candidate_email', email)
    .maybeSingle()
  if (!iv) return { ok: false, error: 'Interview not found.' }
  if (iv.status !== 'booked' && iv.status !== 'confirmed')
    return { ok: false, error: 'This interview can no longer be changed.' }
  if (new Date(iv.scheduled_at).getTime() <= Date.now())
    return { ok: false, error: 'This interview has already started — contact the team to change it.' }

  const { error } = await admin()
    .from('interviews')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', interviewId)
  if (error) return { ok: false, error: error.message }
  // Free the slot back to the pool so it (or another) can be re-booked.
  if (iv.slot_id) await admin().from('interview_slots').update({ status: 'open' }).eq('id', iv.slot_id).eq('status', 'booked')
  // Cancel the Google Calendar event (notifies attendees). Best-effort.
  if (iv.calendar_event_id) await deleteInterviewEvent(iv.calendar_event_id as string)

  revalidatePath('/candidate/interview')
  return { ok: true }
}
