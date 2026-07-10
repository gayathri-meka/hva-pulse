import { createClient } from '@supabase/supabase-js'
import { requireInterviewer } from '@/lib/auth'
import { getMySchedule } from './actions'
import InterviewerClient from './InterviewerClient'

export const dynamic = 'force-dynamic'

export default async function InterviewerPage() {
  await requireInterviewer()
  const { slots, interviews } = await getMySchedule()

  // Candidate display names (prospects is staff-only under RLS → service role).
  const emails = [...new Set(interviews.map((i) => i.candidateEmail))]
  const nameByEmail: Record<string, string> = {}
  if (emails.length) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await admin.from('prospects').select('email, name').in('email', emails)
    for (const p of data ?? []) nameByEmail[p.email] = (p.name as string) ?? p.email
  }

  return (
    <div>
      <h1 className="text-xl font-bold tracking-tight text-zinc-900">Your interviews</h1>
      <p className="mt-1 text-sm text-zinc-500">Publish your availability, and candidates book from it. You get a calendar invite when a slot is booked.</p>
      <InterviewerClient slots={slots} interviews={interviews} nameByEmail={nameByEmail} />
    </div>
  )
}
