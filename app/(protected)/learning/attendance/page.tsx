import { redirect } from 'next/navigation'
import LearningTabs from '@/components/learning/LearningTabs'
import { topLevelLearningTabs } from '@/lib/learning/tabs'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AttendanceClient, {
  type AttendanceData,
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

// Page-load query: keep this lean. participant_name + duration_minutes are
// fetched on demand when a ✓ pill is clicked (see actions.ts).
type AttendanceRow = {
  meeting_code:      string
  participant_email: string
  call_date:         string
  call_time:         string | null
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
      'meeting_code, participant_email, call_date, call_time',
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
        tabs={topLevelLearningTabs({ role: appUser.role })}
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

  // Compact presence map: sessionKey -> list of attendee emails. Strips
  // ~5k name/duration objects out of the page payload; the modal fetches
  // those on demand via the getAttendees server action.
  const presence: Record<string, string[]> = {}
  for (const a of attendance) {
    const sessionKey = `${a.meeting_code}::${a.call_date}`
    const email = a.participant_email.toLowerCase()
    if (!presence[sessionKey]) presence[sessionKey] = []
    presence[sessionKey].push(email)
  }

  return { batches, learners: learnerList, sessions, presence }
}
