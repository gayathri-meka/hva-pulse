import { redirect } from 'next/navigation'
import LearningTabs from '@/components/learning/LearningTabs'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AttendanceClient, {
  type AttendanceData,
  type AttendeeFlat,
  type LearnerFlat,
  type SessionFlat,
} from './AttendanceClient'

export const dynamic = 'force-dynamic'

type CallRow = {
  meeting_code: string
  name:         string
  type:         string
  batch:        string | null
}

type AttendanceRow = {
  meeting_code:      string
  participant_email: string
  participant_name:  string | null
  call_date:         string
  call_time:         string | null
  duration_minutes:  number | null
}

type LearnerRow = {
  learner_id:        string
  batch_name:        string | null
  new_batch:         string | null
  status:            string | null
  users: { id: string; email: string; name: string } | null
}

export default async function AttendancePage() {
  const appUser = await getAppUser()
  if (!appUser || appUser.role === 'learner') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  // Supabase enforces a project-level `max-rows` cap (default 1000) at the
  // PostgREST layer that overrides `.limit()` requests. Page through with
  // .range() so we reliably get every row regardless of that cap.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  async function fetchAll<T>(
    table: string,
    cols: string,
    apply?: (q: any) => any,
  ): Promise<T[]> {
    const PAGE = 1000
    const out: T[] = []
    let from = 0
    for (;;) {
      const base = supabase.from(table).select(cols)
      const q = apply ? apply(base) : base
      const { data, error } = await q.range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as T[]
      out.push(...rows)
      if (rows.length < PAGE) break
      from += PAGE
    }
    return out
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const [calls, attendance, learners] = await Promise.all([
    fetchAll<CallRow>('calls', 'meeting_code, name, type, batch'),
    fetchAll<AttendanceRow>(
      'attendance_records',
      'meeting_code, participant_email, participant_name, call_date, call_time, duration_minutes',
    ),
    // Only count "Ongoing" learners.
    fetchAll<LearnerRow>(
      'learners',
      'learner_id, batch_name, new_batch, status, users!learners_user_id_fkey(id, email, name)',
      (q) => q.eq('is_current_cohort', true).eq('status', 'Ongoing'),
    ),
  ])

  const data = buildData(
    calls,
    attendance,
    learners as unknown as LearnerRow[],
  )

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <LearningTabs
        activeKey="attendance"
        tabs={[
          { key: 'all',        label: 'Dashboard',  href: '/learning?filter=all' },
          { key: 'cases',      label: 'Cases',      href: '/learning?filter=cases' },
          { key: 'attendance', label: 'Attendance', href: '/learning/attendance' },
          { key: 'deep-dive',  label: 'Deep Dive',  href: '/learning/deep-dive' },
          { key: 'settings', label: 'Settings', href: '/learning/settings' },
        ]}
      />

      <h1 className="mb-6 text-2xl font-bold tracking-tight text-zinc-900">Attendance</h1>

      <AttendanceClient data={data} />
    </div>
  )
}

// ── Aggregation ──────────────────────────────────────────────────────────────

function buildData(
  calls:      CallRow[],
  attendance: AttendanceRow[],
  learners:   LearnerRow[],
): AttendanceData {
  // A learner's "effective batch" is new_batch when set (they've transitioned
  // to BE1/JS3/etc), otherwise batch_name.
  function effectiveBatch(l: LearnerRow): string | null {
    return (l.new_batch && l.new_batch.trim()) || (l.batch_name && l.batch_name.trim()) || null
  }

  // Flat learner list with effective batch
  const learnerList: LearnerFlat[] = []
  for (const l of learners) {
    const b = effectiveBatch(l)
    if (!b || !l.users?.email) continue
    learnerList.push({
      id:    l.users.id,
      email: l.users.email.toLowerCase(),
      name:  l.users.name ?? l.users.email,
      batch: b,
    })
  }

  // Distinct batches — union of learner effective batches and calls.batch
  // (excluding "All"/blank from the calls side; those are special).
  const batchSet = new Set<string>()
  for (const l of learnerList) batchSet.add(l.batch)
  for (const c of calls) {
    if (c.batch && c.batch !== 'All') batchSet.add(c.batch)
  }
  const batches = Array.from(batchSet).sort()

  // Call metadata by meeting_code
  const callMeta = new Map<string, CallRow>()
  for (const c of calls) callMeta.set(c.meeting_code, c)

  // Distinct sessions = (meeting_code, call_date) with the earliest time seen
  const sessionMap = new Map<string, SessionFlat>()
  for (const a of attendance) {
    const key = `${a.meeting_code}::${a.call_date}`
    const meta = callMeta.get(a.meeting_code)
    if (!meta) continue
    const existing = sessionMap.get(key)
    if (!existing) {
      sessionMap.set(key, {
        meeting_code: a.meeting_code,
        name:         meta.name,
        type:         meta.type,
        batch:        meta.batch,
        date:         a.call_date,
        time:         a.call_time,
      })
    } else if (a.call_time && (!existing.time || a.call_time < existing.time)) {
      existing.time = a.call_time
    }
  }
  const sessions = Array.from(sessionMap.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    return (b.time ?? '').localeCompare(a.time ?? '')
  })

  // Per-session attendee list. Keyed by `${meeting_code}::${date}`.
  // Each entry is one attendee row (with duration). If the email matches a
  // learner in our roster we attach their batch; otherwise we keep them
  // anonymous (could be a mentor/external) so they still count as "attended".
  const learnerByEmail = new Map<string, LearnerFlat>()
  for (const l of learnerList) learnerByEmail.set(l.email, l)

  const attendeesBySession: Record<string, AttendeeFlat[]> = {}
  for (const a of attendance) {
    const sessionKey = `${a.meeting_code}::${a.call_date}`
    const email = a.participant_email.toLowerCase()
    const matched = learnerByEmail.get(email) ?? null
    const entry: AttendeeFlat = {
      email,
      name:             matched?.name ?? a.participant_name ?? email,
      batch:            matched?.batch ?? null,
      learnerId:        matched?.id ?? null,
      duration_minutes: a.duration_minutes,
    }
    if (!attendeesBySession[sessionKey]) attendeesBySession[sessionKey] = []
    attendeesBySession[sessionKey].push(entry)
  }

  // A flat set of presence keys is still handy for the per-learner stats
  // (no need to scan attendee arrays repeatedly).
  const presentKeys: string[] = []
  for (const a of attendance) {
    presentKeys.push(
      `${a.meeting_code}::${a.call_date}::${a.participant_email.toLowerCase()}`,
    )
  }

  return { batches, learners: learnerList, sessions, presentKeys, attendeesBySession }
}
