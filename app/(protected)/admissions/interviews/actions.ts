'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { requireStaff, getAppUser } from '@/lib/auth'
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
