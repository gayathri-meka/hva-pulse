'use client'

import { useState } from 'react'

export type TaskState = 'not_started' | 'attempted' | 'completed'
export type TaskItem = { taskId: string; title: string; type: string; ordering: number; state: TaskState }
export type DayProgress = { ordering: number; name: string; tasks: TaskItem[]; completed: number; total: number }
export type Member = {
  email: string
  name: string
  source: 'pulse' | 'sensai'
  days: DayProgress[]
  totalTasks: number
  completedTasks: number
  started: boolean
  lastActive: string | null
}
export type CohortDay = {
  ordering: number
  name: string
  totalTasks: number
  avgPct: number
  fullyCompleted: number
  started: number
  memberCount: number
}

const pct = (c: number, t: number) => (t ? Math.round((c / t) * 100) : 0)

// Accordion row template — inline style (not a Tailwind arbitrary class) so the
// decimal fr values reliably compile.
const ROW_COLS = '1.6fr 1.4fr 0.7fr 0.7fr'

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className="h-full rounded-full bg-[#5BAE5B]" style={{ width: `${value}%` }} />
    </div>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const STATE_DOT: Record<TaskState, string> = {
  completed: 'bg-[#5BAE5B]',
  attempted: 'bg-amber-400',
  not_started: 'bg-zinc-200',
}
const STATE_LABEL: Record<TaskState, string> = {
  completed: 'Done',
  attempted: 'In progress',
  not_started: 'Not started',
}

// Heatmap tone for a (completed/total) day cell in the matrix view.
function cellTone(completed: number, total: number) {
  if (total === 0) return 'bg-zinc-50 text-zinc-300'
  if (completed === 0) return 'bg-zinc-50 text-zinc-400'
  if (completed >= total) return 'bg-emerald-100 text-emerald-800'
  return 'bg-amber-50 text-amber-700'
}

export default function ChallengeClient({
  members,
  cohortDays,
}: {
  members: Member[]
  cohortDays: CohortDay[]
}) {
  const [view, setView] = useState<'detail' | 'matrix'>('detail')
  const [openMember, setOpenMember] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)

  if (members.length === 0) {
    return <p className="text-sm text-zinc-400">No one has joined the challenge cohort yet.</p>
  }

  return (
    <div className="space-y-8">
      {/* ── Cohort progress by day ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Cohort progress by day
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {cohortDays.map((d) => (
            <div key={d.ordering} className="min-w-[150px] flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-zinc-900">{d.name}</div>
              <div className="mt-0.5 text-[11px] text-zinc-400">{d.totalTasks} tasks</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-zinc-900">{d.avgPct}%</span>
                <span className="text-[11px] text-zinc-400">avg done</span>
              </div>
              <div className="mt-1.5">
                <Bar value={d.avgPct} />
              </div>
              <div className="mt-2 text-[11px] text-zinc-500">
                {d.fullyCompleted}/{d.memberCount} completed · {d.started} started
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Members ─────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Members ({members.length})
          </h2>
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
            {([
              ['detail', 'Detailed'],
              ['matrix', 'Day-by-day'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`rounded-md px-3 py-1 transition-colors ${
                  view === key ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {view === 'detail' ? (
          <DetailView
            members={members}
            openMember={openMember}
            setOpenMember={setOpenMember}
            openDay={openDay}
            setOpenDay={setOpenDay}
          />
        ) : (
          <MatrixView members={members} cohortDays={cohortDays} />
        )}
      </section>
    </div>
  )
}

// ── Detailed (accordion) view ──────────────────────────────────────────────
function DetailView({
  members,
  openMember,
  setOpenMember,
  openDay,
  setOpenDay,
}: {
  members: Member[]
  openMember: string | null
  setOpenMember: (v: string | null) => void
  openDay: string | null
  setOpenDay: (v: string | null) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      {/* Header */}
      <div
        className="grid items-center gap-3 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
        style={{ gridTemplateColumns: ROW_COLS }}
      >
        <span>Member</span>
        <span>Progress</span>
        <span>Started</span>
        <span className="text-right">Last active</span>
      </div>

      {members.map((m) => {
        const isOpen = openMember === m.email
        return (
          <div key={m.email} className="border-b border-zinc-100 last:border-b-0">
            <button
              onClick={() => {
                setOpenMember(isOpen ? null : m.email)
                setOpenDay(null)
              }}
              className="grid w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-50"
              style={{ gridTemplateColumns: ROW_COLS }}
            >
              {/* Name + source */}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Chevron open={isOpen} />
                  <span className="truncate text-sm font-semibold text-zinc-900">{m.name}</span>
                  <SourceChip source={m.source} />
                </div>
                <div className="ml-[22px] truncate text-xs text-zinc-400">{m.email}</div>
              </div>

              {/* Progress */}
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>{m.completedTasks}/{m.totalTasks} tasks</span>
                  <span className="font-semibold text-zinc-700">{pct(m.completedTasks, m.totalTasks)}%</span>
                </div>
                <Bar value={pct(m.completedTasks, m.totalTasks)} />
              </div>

              {/* Started */}
              <div>
                {m.started ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Started</span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-400">Not yet</span>
                )}
              </div>

              {/* Last active */}
              <div className="text-right text-xs text-zinc-500">{fmtDate(m.lastActive)}</div>
            </button>

            {/* Expanded: day breakdown */}
            {isOpen && (
              <div className="space-y-1.5 bg-zinc-50/60 px-4 py-3 pl-11">
                {m.days.map((d) => {
                  const dayKey = `${m.email}:${d.ordering}`
                  const dayOpen = openDay === dayKey
                  return (
                    <div key={d.ordering} className="rounded-lg border border-zinc-200 bg-white">
                      <button
                        onClick={() => setOpenDay(dayOpen ? null : dayKey)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left"
                      >
                        <Chevron open={dayOpen} />
                        <span className="w-28 shrink-0 text-sm font-medium text-zinc-800">{d.name}</span>
                        <div className="flex-1">
                          <Bar value={pct(d.completed, d.total)} />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs text-zinc-500">{d.completed}/{d.total} done</span>
                      </button>

                      {dayOpen && (
                        <ul className="border-t border-zinc-100 px-3 py-2">
                          {d.tasks.map((t) => (
                            <li key={t.taskId} className="flex items-center gap-2.5 py-1">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${STATE_DOT[t.state]}`} />
                              <span className={`flex-1 truncate text-sm ${t.state === 'completed' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                                {t.title}
                              </span>
                              {t.type === 'quiz' && (
                                <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400">quiz</span>
                              )}
                              <span className="w-20 shrink-0 text-right text-[11px] text-zinc-400">{STATE_LABEL[t.state]}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Day-by-day matrix view ─────────────────────────────────────────────────
function MatrixView({ members, cohortDays }: { members: Member[]; cohortDays: CohortDay[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-2.5 text-left">Member</th>
            {cohortDays.map((d) => (
              <th key={d.ordering} className="whitespace-nowrap px-2 py-2.5 text-center font-semibold" title={`${d.totalTasks} tasks`}>
                {d.name}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right">Overall</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const byOrdering = new Map(m.days.map((d) => [d.ordering, d]))
            return (
              <tr key={m.email} className="border-t border-zinc-100">
                <td className="sticky left-0 z-10 bg-white px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-zinc-900">{m.name}</span>
                    <SourceChip source={m.source} />
                  </div>
                  <div className="truncate text-xs text-zinc-400">{m.email}</div>
                </td>
                {cohortDays.map((cd) => {
                  const d = byOrdering.get(cd.ordering)
                  const completed = d?.completed ?? 0
                  const total = d?.total ?? cd.totalTasks
                  return (
                    <td key={cd.ordering} className="px-1.5 py-1.5 text-center">
                      <div className={`mx-auto rounded-md px-2 py-1.5 text-xs font-medium ${cellTone(completed, total)}`}>
                        {completed}/{total}
                      </div>
                    </td>
                  )
                })}
                <td className="px-3 py-2.5 text-right font-semibold text-zinc-700">
                  {pct(m.completedTasks, m.totalTasks)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Small shared bits ──────────────────────────────────────────────────────
function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function SourceChip({ source }: { source: 'pulse' | 'sensai' }) {
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        source === 'pulse' ? 'bg-[#E1F5EE] text-[#085041]' : 'bg-zinc-100 text-zinc-500'
      }`}
    >
      {source === 'pulse' ? 'Pulse' : 'SensAI'}
    </span>
  )
}
