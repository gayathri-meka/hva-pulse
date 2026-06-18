import { createClient } from '@supabase/supabase-js'
import { getAppUser } from '@/lib/auth'
import { challengeFunnel, CHALLENGE_VIEW } from '@/lib/challengeFunnel'
import AdmissionsSummary from '@/components/admissions/AdmissionsSummary'
import SourceSyncButton, { type SyncSource } from '@/components/learning/SourceSyncButton'
import ChallengeClient, {
  type Member,
  type CohortDay,
  type TaskState,
} from '@/components/admissions/ChallengeClient'

export const dynamic = 'force-dynamic'

// CHALLENGE_VIEW ('pulse_challenge_task_status', migrations/bq/004) is synced into
// metric_raw_rows as the "Challenge Completion" source — one row per (member, task).

type Dim = Record<string, string | null>
const num = (v: string | null | undefined) => (v == null || v === '' ? 0 : Number(v))

// BigQuery TIMESTAMPs land in metric_raw_rows as epoch-seconds strings in
// scientific notation (e.g. "1.781682303E9"), so new Date() on them is invalid.
// Normalise to epoch-ms; also tolerate ISO strings / {value} objects just in case.
function activityMs(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'object' && 'value' in (v as Record<string, unknown>)) v = (v as { value: unknown }).value
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  if (typeof v === 'string') {
    const n = Number(v)
    if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n
    const parsed = Date.parse(v)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export default async function AdmissionsChallengePage() {
  const appUser = await getAppUser()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: src } = await supabase
    .from('metric_sources')
    .select('id, name, last_synced_at, sync_error, row_count')
    .eq('bq_table', CHALLENGE_VIEW)
    .maybeSingle()

  if (!src) {
    return (
      <div>
        <AdmissionsSummary description="Everyone who joined the 14-day challenge screening cohort." />
        <p className="text-sm text-zinc-400">
          Challenge data source not connected yet. Connect the{' '}
          <code className="rounded bg-zinc-100 px-1">{CHALLENGE_VIEW}</code> BigQuery view in
          Learning → Settings → Data Sources.
        </p>
      </div>
    )
  }

  // PostgREST caps a single response at max-rows (1000 by default), so .limit()
  // alone silently truncates — page through with .range() to load every row.
  async function fetchAllRawRows(sourceId: string) {
    const PAGE = 1000
    const all: { learner_id: string | null; dimensions: Dim | null }[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('metric_raw_rows')
        .select('learner_id, dimensions')
        .eq('source_id', sourceId)
        .range(from, from + PAGE - 1)
      if (error) throw error
      if (!data?.length) break
      all.push(...(data as { learner_id: string | null; dimensions: Dim | null }[]))
      if (data.length < PAGE) break
    }
    return all
  }

  const [fetchedRows, { data: prospectRows }] = await Promise.all([
    fetchAllRawRows(src.id),
    supabase.from('prospects').select('email, name'),
  ])

  // Defensive dedupe: syncDataSource does a non-atomic delete-then-insert, so two
  // overlapping syncs can leave duplicate (member, task) rows — which doubles every
  // task in the UI and breaks React keys. Collapse to one row per (learner_id, task_id).
  const seenKey = new Set<string>()
  const rawRows = fetchedRows.filter((r) => {
    const key = `${(r.learner_id ?? '').trim().toLowerCase()}|${(r.dimensions as Dim)?.task_id ?? ''}`
    if (seenKey.has(key)) return false
    seenKey.add(key)
    return true
  })

  const prospectName = new Map(
    (prospectRows ?? []).map((p) => [p.email.trim().toLowerCase(), p.name as string | null]),
  )

  // Group every (member, task) row by member email.
  const byEmail = new Map<string, Dim[]>()
  for (const r of rawRows ?? []) {
    const email = (r.learner_id ?? '').trim().toLowerCase()
    if (!email) continue
    if (!byEmail.has(email)) byEmail.set(email, [])
    byEmail.get(email)!.push((r.dimensions ?? {}) as Dim)
  }

  const members: Member[] = [...byEmail.entries()]
    .map(([email, dims]) => {
      // Group this member's tasks into days (milestones), ordered.
      const dayMap = new Map<number, { name: string; tasks: Member['days'][number]['tasks'] }>()
      for (const d of dims) {
        const ord = num(d.milestone_ordering)
        if (!dayMap.has(ord)) dayMap.set(ord, { name: d.milestone_name ?? `Day ${ord + 1}`, tasks: [] })
        dayMap.get(ord)!.tasks.push({
          taskId: d.task_id ?? '',
          title: d.task_title ?? 'Task',
          type: d.task_type ?? '',
          ordering: num(d.task_ordering),
          state: (d.state as TaskState) ?? 'not_started',
        })
      }
      const days = [...dayMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([ordering, v]) => {
          const tasks = v.tasks.sort((a, b) => a.ordering - b.ordering)
          return {
            ordering,
            name: v.name,
            tasks,
            completed: tasks.filter((t) => t.state === 'completed').length,
            total: tasks.length,
          }
        })
      const totalTasks = days.reduce((s, d) => s + d.total, 0)
      const completedTasks = days.reduce((s, d) => s + d.completed, 0)
      const started = dims.some((d) => (d.state ?? 'not_started') !== 'not_started')
      const activityTimes = dims.map((d) => activityMs(d.last_activity_at)).filter((n): n is number => n != null)
      const lastActive = activityTimes.length ? new Date(Math.max(...activityTimes)).toISOString() : null
      return {
        email,
        name: prospectName.get(email) || dims[0]?.learner_name || email,
        source: (prospectName.has(email) ? 'pulse' : 'sensai') as Member['source'],
        days,
        totalTasks,
        completedTasks,
        started,
        lastActive,
      }
    })
    .sort((a, b) => b.completedTasks - a.completedTasks || a.name.localeCompare(b.name))

  // Cohort-level per-day rollup.
  const memberCount = members.length
  const agg = new Map<number, { name: string; total: number; pctSum: number; fully: number; started: number }>()
  for (const m of members) {
    for (const d of m.days) {
      if (!agg.has(d.ordering)) agg.set(d.ordering, { name: d.name, total: d.total, pctSum: 0, fully: 0, started: 0 })
      const a = agg.get(d.ordering)!
      a.pctSum += d.total ? d.completed / d.total : 0
      if (d.total && d.completed === d.total) a.fully += 1
      if (d.tasks.some((t) => t.state !== 'not_started')) a.started += 1
    }
  }
  const cohortDays: CohortDay[] = [...agg.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ordering, a]) => ({
      ordering,
      name: a.name,
      totalTasks: a.total,
      avgPct: memberCount ? Math.round((a.pctSum / memberCount) * 100) : 0,
      fullyCompleted: a.fully,
      started: a.started,
      memberCount,
    }))

  const { joined, started: startedCount, completed: completedCount } = challengeFunnel(
    (rawRows ?? []) as { learner_id: string | null; dimensions: Record<string, string | null> | null }[],
  )

  const syncSource: SyncSource = {
    id: src.id,
    name: src.name,
    last_synced_at: src.last_synced_at,
    sync_error: src.sync_error,
    row_count: src.row_count,
  }

  return (
    <div>
      <AdmissionsSummary
        description="Everyone who joined the 14-day challenge screening cohort, with their day-by-day completion on SensAI."
        stats={[
          { value: joined, label: 'joined' },
          { value: startedCount, label: 'started' },
          { value: completedCount, label: 'completed' },
        ]}
      />
      {appUser?.role === 'admin' && (
        <div className="mb-4 flex items-center justify-end">
          <SourceSyncButton sources={[syncSource]} />
        </div>
      )}
      <ChallengeClient members={members} cohortDays={cohortDays} />
    </div>
  )
}
