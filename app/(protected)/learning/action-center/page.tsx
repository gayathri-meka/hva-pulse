import { redirect } from 'next/navigation'
import LearningTabs from '@/components/learning/LearningTabs'
import { topLevelLearningTabs } from '@/lib/learning/tabs'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ActionCenterClient, {
  type ActionCenterData,
  type ActionLearner,
  type ActionCall,
} from './ActionCenterClient'

export const dynamic = 'force-dynamic'

type LearnerRow = {
  learner_id: string
  lf_name:    string | null
  batch_name: string | null
  new_lf:     string | null
  new_batch:  string | null
  users: { id: string; email: string; name: string } | null
}

type AttendanceRow = {
  meeting_code:      string
  participant_email: string
  duration_minutes:  number | null
}

const MIN_CALL_MINUTES = 5

type CallRow = {
  meeting_code: string
  name:         string
  type:         string
  batch:        string | null
}

// IST = UTC + 5:30. en-CA locale gives YYYY-MM-DD.
function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function labelForDate(iso: string): string {
  // Render YYYY-MM-DD as "Weekday, D MMM YYYY" in en-IN/IST.
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, 12)) // noon UTC dodges DST/timezone edges
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    day:     'numeric',
    month:   'short',
    year:    'numeric',
  })
}

export default async function ActionCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; lf?: string }>
}) {
  const appUser = await getAppUser()
  if (!appUser || appUser.role === 'learner') redirect('/dashboard')

  const { date: dateParam, lf: lfParam } = await searchParams
  const supabase = await createServerSupabaseClient()
  const today    = dateParam || todayIST()

  // Fetch in parallel.
  const [{ data: learnersRaw }, { data: attendanceTodayRaw }] = await Promise.all([
    supabase
      .from('learners')
      .select('learner_id, lf_name, batch_name, new_lf, new_batch, users!learners_user_id_fkey(id, email, name)')
      .eq('is_current_cohort', true)
      .eq('status', 'Ongoing'),
    supabase
      .from('attendance_records')
      .select('meeting_code, participant_email, duration_minutes')
      .eq('call_date', today),
  ])

  // Effective batch + LF (new_* wins when set)
  function effectiveBatch(l: LearnerRow): string | null {
    return (l.new_batch?.trim()) || (l.batch_name?.trim()) || null
  }
  function effectiveLf(l: LearnerRow): string | null {
    return (l.new_lf?.trim()) || (l.lf_name?.trim()) || null
  }

  const learners: ActionLearner[] = []
  for (const l of (learnersRaw ?? []) as unknown as LearnerRow[]) {
    if (!l.users?.email) continue
    const batch = effectiveBatch(l)
    if (!batch) continue
    learners.push({
      id:      l.users.id,
      email:   l.users.email.toLowerCase(),
      name:    l.users.name ?? l.users.email,
      batch,
      lfName:  effectiveLf(l),
    })
  }

  // Calls referenced in today's attendance — with the 5-min minimum applied.
  // Drop any call whose longest attendance was < 5 min (test calls, abandoned
  // meeting rooms). Same rule as the Attendance tab.
  const todayAttendance = (attendanceTodayRaw ?? []) as AttendanceRow[]
  const maxDurByCode = new Map<string, number>()
  for (const a of todayAttendance) {
    const dur = a.duration_minutes ?? 0
    if (dur > (maxDurByCode.get(a.meeting_code) ?? 0)) maxDurByCode.set(a.meeting_code, dur)
  }
  const validCodes = new Set<string>()
  for (const [code, max] of maxDurByCode) {
    if (max >= MIN_CALL_MINUTES) validCodes.add(code)
  }
  const meetCodes = Array.from(validCodes)

  let callsToday: ActionCall[] = []
  const presenceByCall: Record<string, string[]> = {}
  if (meetCodes.length > 0) {
    const { data: callsRaw } = await supabase
      .from('calls')
      .select('meeting_code, name, type, batch')
      .in('meeting_code', meetCodes)
    callsToday = ((callsRaw ?? []) as CallRow[]).map((c) => ({
      meeting_code: c.meeting_code,
      name:         c.name,
      type:         c.type,
      batch:        c.batch,
    }))
    for (const a of todayAttendance) {
      if (!validCodes.has(a.meeting_code)) continue
      if (!presenceByCall[a.meeting_code]) presenceByCall[a.meeting_code] = []
      presenceByCall[a.meeting_code].push(a.participant_email.toLowerCase())
    }
  }

  // LF dropdown options. "All" plus distinct LFs.
  const lfList = Array.from(
    new Set(learners.map((l) => l.lfName).filter((v): v is string => !!v)),
  ).sort()

  // Default LF: explicit URL param wins; else fall back to current user's
  // name if they're an LF; else empty (= All).
  const userName = appUser.name ?? ''
  const fallbackLf = userName && lfList.includes(userName) ? userName : ''
  const initialLf  = lfParam ?? fallbackLf

  const firstName = (appUser.name ?? '').trim().split(/\s+/)[0] || null

  const data: ActionCenterData = {
    date:       today,
    dateLabel:  labelForDate(today),
    firstName,
    learners,
    callsToday,
    presenceByCall,
    lfList,
    initialLf,
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <LearningTabs
        activeKey="action-center"
        tabs={topLevelLearningTabs({ role: appUser.role })}
      />

      <ActionCenterClient data={data} />
    </div>
  )
}
