'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireStaff, requireInterviewer, getAppUser } from '@/lib/auth'
import { normEmail, type InterviewSlot, type Interview } from '@/lib/interviews'

// Admin/staff view of the whole interview programme: interviewers, the slot pool,
// all bookings, and metrics. Adding an interviewer = a users row with role
// 'interviewer' (admin only).

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

type Err = { ok: false; error: string }
type Ok = { ok: true }

/** Add an interviewer (a Pulse user with role 'interviewer'). Admin only. */
export async function addInterviewer(input: { email: string; name: string }): Promise<Ok | Err> {
  const user = await getAppUser()
  if (!user || user.role !== 'admin') return { ok: false, error: 'Only admins can add interviewers.' }
  const email = normEmail(input.email)
  const name = input.name?.trim()
  if (!email || !email.includes('@')) return { ok: false, error: 'Enter a valid email.' }

  const { data: existing } = await admin().from('users').select('id, role').eq('email', email).maybeSingle()
  if (existing) {
    if (existing.role !== 'interviewer')
      return { ok: false, error: `That email is already a Pulse ${existing.role}.` }
    return { ok: true } // already an interviewer
  }
  const { error } = await admin().from('users').insert({ email, name: name || null, role: 'interviewer' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admissions/interviews')
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
const SLOT_MINUTES = 30

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSlot = (r: any): InterviewSlot => ({ id: r.id, interviewerEmail: r.interviewer_email, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toInterview = (r: any): Interview => ({ id: r.id, candidateEmail: r.candidate_email, round: r.round, slotId: r.slot_id, interviewerEmail: r.interviewer_email, scheduledAt: r.scheduled_at, status: r.status, meetLink: r.meet_link ?? null })

/** The logged-in interviewer's own slots + interviews (for the paint-week grid). */
export async function getMyCalendar(): Promise<{
  slots: InterviewSlot[]
  interviews: (Interview & { candidateName: string | null })[]
}> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)
  const a = admin()
  const [slotsRes, ivRes] = await Promise.all([
    a.from('interview_slots').select('*').eq('interviewer_email', email).order('starts_at'),
    a.from('interviews').select('*').eq('interviewer_email', email).neq('status', 'cancelled').order('scheduled_at'),
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
  }
}

/**
 * Reconcile this interviewer's OPEN availability for one week to exactly the given
 * set of 30-min slot start times. Creates missing open slots, deletes open slots no
 * longer wanted; never touches booked slots. Past starts are ignored.
 */
export async function syncWeekAvailability(input: {
  weekStartIso: string
  starts: string[] // ISO start times of desired 30-min available slots
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireInterviewer()
  const email = normEmail(user.email)
  const a = admin()

  const weekStart = new Date(input.weekStartIso)
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60_000)
  if (Number.isNaN(weekStart.getTime())) return { ok: false, error: 'Invalid week.' }

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
  revalidatePath('/admissions/interviews/calendar')
  return { ok: true }
}

export type InterviewerRow = { email: string; name: string | null; openSlots: number; booked: number; completed: number }

/** Everything the admin Interviews tab renders. */
export async function getInterviewOverview(): Promise<{
  interviewers: InterviewerRow[]
  slots: InterviewSlot[]
  interviews: (Interview & { candidateName: string | null; interviewerName: string | null })[]
}> {
  await requireStaff()
  const a = admin()
  const [usersRes, slotsRes, ivRes] = await Promise.all([
    a.from('users').select('email, name').eq('role', 'interviewer').order('name'),
    a.from('interview_slots').select('*').order('starts_at'),
    a.from('interviews').select('*').order('scheduled_at', { ascending: false }),
  ])
  const roleInterviewers = usersRes.data ?? []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slots: InterviewSlot[] = (slotsRes.data ?? []).map((r: any) => ({ id: r.id, interviewerEmail: r.interviewer_email, startsAt: r.starts_at, endsAt: r.ends_at, status: r.status }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawIv = (ivRes.data ?? []) as any[]

  // Every email that acts as an interviewer = dedicated 'interviewer' users PLUS any
  // admin/staff who published slots or conducted interviews. Resolve all their names.
  const interviewerEmails = [...new Set([
    ...roleInterviewers.map((u) => u.email),
    ...slots.map((s) => s.interviewerEmail),
    ...rawIv.map((r) => r.interviewer_email),
  ])]
  const nameByEmail = new Map<string, string | null>()
  if (interviewerEmails.length) {
    const { data } = await a.from('users').select('email, name').in('email', interviewerEmails)
    for (const u of data ?? []) nameByEmail.set(u.email, (u.name as string | null) ?? null)
  }

  const candEmails = [...new Set(rawIv.map((r) => r.candidate_email))]
  const candName = new Map<string, string>()
  if (candEmails.length) {
    const { data } = await a.from('prospects').select('email, name').in('email', candEmails)
    for (const p of data ?? []) candName.set(p.email, (p.name as string) ?? p.email)
  }

  const interviews = rawIv.map((r) => ({
    id: r.id, candidateEmail: r.candidate_email, round: r.round, slotId: r.slot_id,
    interviewerEmail: r.interviewer_email, scheduledAt: r.scheduled_at, status: r.status, meetLink: r.meet_link ?? null,
    candidateName: candName.get(r.candidate_email) ?? null,
    interviewerName: nameByEmail.get(r.interviewer_email) ?? null,
  }))

  // Show anyone who is a dedicated interviewer OR has published/conducted anything.
  const activeEmails = new Set([...slots.map((s) => s.interviewerEmail), ...interviews.map((i) => i.interviewerEmail)])
  const listedEmails = [...new Set([...roleInterviewers.map((u) => u.email), ...activeEmails])]
  const interviewers: InterviewerRow[] = listedEmails.map((email) => ({
    email,
    name: nameByEmail.get(email) ?? null,
    openSlots: slots.filter((s) => s.interviewerEmail === email && s.status === 'open').length,
    booked: interviews.filter((i) => i.interviewerEmail === email && (i.status === 'booked' || i.status === 'confirmed')).length,
    completed: interviews.filter((i) => i.interviewerEmail === email && i.status === 'completed').length,
  }))

  return { interviewers, slots, interviews }
}
