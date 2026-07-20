'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireStaff, requireInterviewer, getAppUser } from '@/lib/auth'
import { normEmail, type InterviewSlot, type Interview } from '@/lib/interviews'
import { deleteInterviewEvent } from '@/lib/googleCalendar'

// Admin/staff view of the whole interview programme: interviewers, the slot pool,
// all bookings, and metrics. Adding an interviewer = a users row with role
// 'interviewer' (admin only).

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Err = { ok: false; error: string }
type Ok = { ok: true }

/** Add an interviewer (a Pulse user with role 'interviewer'), specialised to one
 *  round (1 = Motivation, 2 = Coding). Admin only. */
export async function addInterviewer(input: { email: string; name: string; round: 1 | 2 }): Promise<Ok | Err> {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') return { ok: false, error: 'Only admins can add interviewers.' }
  const email = normEmail(input.email)
  const name = input.name?.trim()
  const round = input.round
  if (!email || !email.includes('@')) return { ok: false, error: 'Enter a valid email.' }
  if (round !== 1 && round !== 2) return { ok: false, error: 'Pick which round this interviewer runs.' }

  const { data: existing } = await admin().from('users').select('id, role').eq('email', email).maybeSingle()
  if (existing) {
    if (existing.role !== 'interviewer')
      return { ok: false, error: `That email is already a Pulse ${existing.role}.` }
    // Already an interviewer — just (re)set their specialisation.
    await admin().from('users').update({ interview_round: round }).eq('email', email)
    revalidatePath('/admissions/interviews')
    return { ok: true }
  }
  const { error } = await admin().from('users').insert({ email, name: name || null, role: 'interviewer', interview_round: round })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews')
  return { ok: true }
}

/** Change an interviewer's round specialisation. Re-tags their OPEN slots so the
 *  availability they've already published moves to the new panel too. Admin only. */
export async function setInterviewerRound(input: { email: string; round: 1 | 2 }): Promise<Ok | Err> {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') return { ok: false, error: 'Only admins can change interviewer roles.' }
  const email = normEmail(input.email)
  if (input.round !== 1 && input.round !== 2) return { ok: false, error: 'Pick a valid round.' }
  const { error } = await admin().from('users').update({ interview_round: input.round }).eq('email', email)
  if (error) return { ok: false, error: error.message }
  // Move their unbooked availability to the new round (booked slots are left alone).
  await admin().from('interview_slots').update({ round: input.round }).eq('interviewer_email', email).eq('status', 'open')
  revalidatePath('/admissions/interviews')
  revalidatePath('/admissions/interviews/calendar')
  return { ok: true }
}

/** Remove an interviewer that has no bookings against them. Admin only. */
export async function removeInterviewer(email: string): Promise<Ok | Err> {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') return { ok: false, error: 'Only admins can remove interviewers.' }
  const e = normEmail(email)
  const { count } = await admin()
    .from('interviews')
    .select('id', { count: 'exact', head: true })
    .eq('interviewer_email', e)
    .neq('status', 'cancelled')
  if ((count ?? 0) > 0) return { ok: false, error: 'This interviewer has interviews — reassign or cancel them first.' }
  await admin().from('interview_slots').delete().eq('interviewer_email', e).eq('status', 'open')
  const { error } = await admin().from('users').delete().eq('email', e).eq('role', 'interviewer')
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews')
  return { ok: true }
}

// ── Personal scheduling calendar (interviewer / admin / staff) ────────────────
const SLOT_MINUTES = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSlot = (r: any): InterviewSlot => ({ id: r.id, interviewerEmail: r.interviewer_email, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, round: r.round ?? null })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toInterview = (r: any): Interview => ({ id: r.id, candidateEmail: r.candidate_email, round: r.round, slotId: r.slot_id, interviewerEmail: r.interviewer_email, scheduledAt: r.scheduled_at, status: r.status, meetLink: r.meet_link ?? null, recommendation: r.recommendation ?? null })

/** The logged-in interviewer's own slots + interviews (for the paint-week grid),
 *  plus their round specialisation so the grid can label what they're publishing. */
export async function getMyCalendar(): Promise<{
  slots: InterviewSlot[]
  interviews: (Interview & { candidateName: string | null })[]
  round: 1 | 2 | null
}> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)
  const a = admin()
  const [slotsRes, ivRes, meRes] = await Promise.all([
    a.from('interview_slots').select('*').eq('interviewer_email', email).order('starts_at'),
    a.from('interviews').select('*').eq('interviewer_email', email).neq('status', 'cancelled').order('scheduled_at'),
    a.from('users').select('interview_round').eq('email', email).maybeSingle(),
  ])
  const interviews = (ivRes.data ?? []).map(toInterview)
  const candEmails = [...new Set(interviews.map((i) => i.candidateEmail))]
  const candName = new Map<string, string>()
  if (candEmails.length) {
    const { data } = await a.from('prospects').select('email, name').in('email', candEmails)
    for (const p of data ?? []) candName.set(p.email, (p.name as string) ?? p.email)
  }
  return {
    slots: (slotsRes.data ?? []).map(toSlot),
    interviews: interviews.map((i) => ({ ...i, candidateName: candName.get(i.candidateEmail) ?? null })),
    round: (meRes.data?.interview_round as 1 | 2 | null) ?? null,
  }
}

/**
 * Reconcile this interviewer's OPEN availability for one week to exactly the given
 * set of 1-hour slot start times. Creates missing open slots, deletes open slots no
 * longer wanted; never touches booked slots. Past starts are ignored.
 */
export async function syncWeekAvailability(input: {
  weekStartIso: string
  starts: string[] // ISO start times of desired 1-hour available slots
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)
  const a = admin()

  const weekStart = new Date(input.weekStartIso)
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000)
  if (Number.isNaN(weekStart.getTime())) return { ok: false, error: 'Invalid week.' }

  // Slots inherit the interviewer's round specialisation. A dedicated interviewer
  // must have one set; admin/staff without one default to Motivation (round 1).
  const { data: me } = await a.from('users').select('interview_round, role').eq('email', email).maybeSingle()
  const slotRound = (me?.interview_round as 1 | 2 | null) ?? null
  if (slotRound == null && me?.role === 'interviewer')
    return { ok: false, error: 'Your interview round isn’t set yet — ask an admin to set it in the Interviews overview.' }
  const round = slotRound ?? 1

  const now = Date.now()
  const wanted = new Set(input.starts.filter((s) => new Date(s).getTime() > now))

  // Existing slots for this interviewer in the week.
  const { data: existing } = await a
    .from('interview_slots')
    .select('id, starts_at, status')
    .eq('interviewer_email', email)
    .gte('starts_at', weekStart.toISOString())
    .lt('starts_at', weekEnd.toISOString())

  const existingOpen = new Map<string, string>() // startISO → slotId
  for (const s of existing ?? []) {
    if (s.status === 'open') existingOpen.set(new Date(s.starts_at).toISOString(), s.id)
  }

  // Delete open slots no longer wanted.
  const toDelete = [...existingOpen.entries()].filter(([iso]) => !wanted.has(iso)).map(([, id]) => id)
  if (toDelete.length) await a.from('interview_slots').delete().in('id', toDelete)

  // Insert newly wanted starts that don't already exist (open OR booked).
  const existingAll = new Set((existing ?? []).map((s) => new Date(s.starts_at).toISOString()))
  const toInsert = [...wanted]
    .filter((iso) => !existingAll.has(iso))
    .map((iso) => ({
      interviewer_email: email,
      starts_at: iso,
      ends_at: new Date(new Date(iso).getTime() + SLOT_MINUTES * 60_000).toISOString(),
      status: 'open' as const,
      round,
    }))
  if (toInsert.length) {
    const { error } = await a.from('interview_slots').insert(toInsert)
    if (error) return { ok: false, error: error.message }
  }

  revalidatePath('/admissions/interviews/calendar')
  return { ok: true }
}

/** Record the outcome of an interview the interviewer conducted. */
export async function setInterviewOutcome(
  interviewId: string,
  outcome: 'completed' | 'no_show',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireInterviewer()
  const isStaff = user.role === 'admin' || user.role === 'staff'
  // Staff/admin may close any interview (from the Interviews tab); a dedicated
  // interviewer only their own (from their calendar).
  let q = admin()
    .from('interviews')
    .update({ status: outcome, updated_at: new Date().toISOString() })
    .eq('id', interviewId)
    .in('status', ['booked', 'confirmed'])
  if (!isStaff) q = q.eq('interviewer_email', normEmail(user.email))
  const { data, error } = await q.select('id')
  if (error) return { ok: false, error: error.message }
  if (!data?.length) return { ok: false, error: 'Interview not found or already closed.' }
  revalidatePath('/admissions/interviews')
  revalidatePath('/admissions/interviews/list')
  revalidatePath('/admissions/interviews/calendar')
  return { ok: true }
}

/** Cancel an interview: mark cancelled, free the slot back to the pool, and delete
 *  the Google Calendar event (notifies attendees). The proper way to cancel — never
 *  delete the interviews row directly (that orphans the calendar event). */
export async function cancelInterview(interviewId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireInterviewer()
  const isStaff = user.role === 'admin' || user.role === 'staff'
  let q = admin().from('interviews').select('id, slot_id, calendar_event_id, status').eq('id', interviewId)
  if (!isStaff) q = q.eq('interviewer_email', normEmail(user.email))
  const { data: iv } = await q.maybeSingle()
  if (!iv) return { ok: false, error: 'Interview not found.' }
  if (iv.status === 'cancelled') return { ok: true } // already cancelled — idempotent

  const { error } = await admin()
    .from('interviews')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', interviewId)
  if (error) return { ok: false, error: error.message }
  if (iv.slot_id) await admin().from('interview_slots').update({ status: 'open' }).eq('id', iv.slot_id).eq('status', 'booked')
  if (iv.calendar_event_id) await deleteInterviewEvent(iv.calendar_event_id as string)

  revalidatePath('/admissions/interviews')
  revalidatePath('/admissions/interviews/list')
  revalidatePath('/admissions/interviews/calendar')
  return { ok: true }
}

export type InterviewerRow = { email: string; name: string | null; round: 1 | 2 | null; openSlots: number; booked: number; completed: number }

/** Everything the admin Interviews tab renders. */
export async function getInterviewOverview(): Promise<{
  interviewers: InterviewerRow[]
  slots: InterviewSlot[]
  interviews: (Interview & { candidateName: string | null; interviewerName: string | null; hasNotes: boolean })[]
}> {
  await requireStaff()
  const a = admin()
  const [usersRes, slotsRes, ivRes] = await Promise.all([
    a.from('users').select('email, name, interview_round').eq('role', 'interviewer').order('name'),
    a.from('interview_slots').select('*').order('starts_at'),
    a.from('interviews').select('*').order('scheduled_at', { ascending: false }),
  ])
  const roleInterviewers = usersRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots: InterviewSlot[] = (slotsRes.data ?? []).map((r: any) => ({ id: r.id, interviewerEmail: r.interviewer_email, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status, round: r.round ?? null }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawIv = (ivRes.data ?? []) as any[]

  // Self-heal: free any slot stuck in 'booked' with no live interview backing it
  // (e.g. a cancellation from an older code path that didn't release the slot).
  // Otherwise that time stays wrongly blocked and the booked-slot count drifts.
  const liveSlotIds = new Set(rawIv.filter((r) => r.status !== 'cancelled' && r.slot_id).map((r) => r.slot_id))
  const orphanBooked = slots.filter((s) => s.status === 'booked' && !liveSlotIds.has(s.id))
  if (orphanBooked.length) {
    await a.from('interview_slots').update({ status: 'open', updated_at: new Date().toISOString() }).in('id', orphanBooked.map((s) => s.id))
    for (const s of orphanBooked) s.status = 'open'
  }

  // Every email that acts as an interviewer = dedicated 'interviewer' users PLUS any
  // admin/staff who published slots or conducted interviews. Resolve all their names.
  const interviewerEmails = [...new Set([
    ...roleInterviewers.map((u) => u.email),
    ...slots.map((s) => s.interviewerEmail),
    ...rawIv.map((r) => r.interviewer_email),
  ])]
  const nameByEmail = new Map<string, string | null>()
  const roundByEmail = new Map<string, 1 | 2 | null>()
  if (interviewerEmails.length) {
    const { data } = await a.from('users').select('email, name, interview_round').in('email', interviewerEmails)
    for (const u of data ?? []) {
      nameByEmail.set(u.email, (u.name as string | null) ?? null)
      roundByEmail.set(u.email, (u.interview_round as 1 | 2 | null) ?? null)
    }
  }

  const candEmails = [...new Set(rawIv.map((r) => r.candidate_email))]
  const candName = new Map<string, string>()
  if (candEmails.length) {
    const { data } = await a.from('prospects').select('email, name').in('email', candEmails)
    for (const p of data ?? []) candName.set(p.email, (p.name as string) ?? p.email)
  }

  // Which interviews already have notes/scores captured (⇒ "View notes" vs "Take notes").
  const ivIds = rawIv.map((r) => r.id)
  const noted = new Set<string>()
  if (ivIds.length) {
    const [{ data: nRows }, { data: sRows }] = await Promise.all([
      a.from('interview_notes').select('interview_id, note').in('interview_id', ivIds),
      a.from('interview_scores').select('interview_id').in('interview_id', ivIds),
    ])
    for (const n of nRows ?? []) if ((n.note ?? '').trim()) noted.add(n.interview_id)
    for (const s of sRows ?? []) noted.add(s.interview_id)
  }

  const interviews = rawIv.map((r) => ({
    id: r.id, candidateEmail: r.candidate_email, round: r.round, slotId: r.slot_id,
    interviewerEmail: r.interviewer_email, scheduledAt: r.scheduled_at, status: r.status, meetLink: r.meet_link ?? null,
    recommendation: r.recommendation ?? null,
    candidateName: candName.get(r.candidate_email) ?? null,
    interviewerName: nameByEmail.get(r.interviewer_email) ?? null,
    hasNotes: noted.has(r.id) || !!r.recommendation,
  }))

  // Show anyone who is a dedicated interviewer OR has published/conducted anything.
  const activeEmails = new Set([...slots.map((s) => s.interviewerEmail), ...interviews.map((i) => i.interviewerEmail)])
  const listedEmails = [...new Set([...roleInterviewers.map((u) => u.email), ...activeEmails])]
  const interviewers: InterviewerRow[] = listedEmails.map((email) => ({
    email,
    name: nameByEmail.get(email) ?? null,
    round: roundByEmail.get(email) ?? null,
    openSlots: slots.filter((s) => s.interviewerEmail === email && s.status === 'open').length,
    booked: interviews.filter((i) => i.interviewerEmail === email && (i.status === 'booked' || i.status === 'confirmed')).length,
    completed: interviews.filter((i) => i.interviewerEmail === email && i.status === 'completed').length,
  }))

  return { interviewers, slots, interviews }
}
