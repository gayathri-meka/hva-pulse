'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import ChallengeMatrixTable from './ChallengeMatrixTable'
import ChallengePaceTable from './ChallengePaceTable'
import ChallengeQuestionsView, { type TaskCatalogDay } from './ChallengeQuestionsView'
import LearnerTaskQuestions from './LearnerTaskQuestions'
import ConversationThreadModal from '@/components/sensai/ConversationThreadModal'
import type { ChatMessage, ScorecardCategory } from '@/lib/sensaiChat'

export type ThreadView = {
  title: string
  subtitle?: string
  messages: ChatMessage[]
  description?: string
  scorecard?: ScorecardCategory[]
}

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
  activityByDate: Record<string, number>  // IST date (YYYY-MM-DD) -> tasks done that day
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
const ROW_COLS = '1.8fr 2.8fr 0.7fr 0.6fr'

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className="h-full rounded-full bg-[#5BAE5B]" style={{ width: `${value}%` }} />
    </div>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  // Explicit locale so server and client render identically (avoids hydration mismatch).
  return new Date(iso).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
}

const STATE_TEXT: Record<TaskState, string> = {
  completed: 'text-[#5BAE5B]',
  attempted: 'text-amber-600',
  not_started: 'text-zinc-400',
}
const STATE_LABEL: Record<TaskState, string> = {
  completed: 'Done',
  attempted: 'In progress',
  not_started: 'Not started',
}

export default function ChallengeClient({
  members,
  cohortDays,
  calendarDates,
}: {
  members: Member[]
  cohortDays: CohortDay[]
  calendarDates: string[]
}) {
  const [view, setView] = useState<'detail' | 'matrix' | 'pace' | 'questions'>('matrix')
  const [openMember, setOpenMember] = useState<string | null>(null)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [thread, setThread] = useState<ThreadView | null>(null)

  // Day → tasks catalog (union across members), powering the By-question tree.
  const taskCatalog = useMemo<TaskCatalogDay[]>(() => {
    const days = new Map<number, { name: string; tasks: Map<string, { title: string; type: string; ordering: number }> }>()
    for (const m of members) {
      for (const d of m.days) {
        if (!days.has(d.ordering)) days.set(d.ordering, { name: d.name, tasks: new Map() })
        const day = days.get(d.ordering)!
        for (const t of d.tasks) {
          if (!day.tasks.has(t.taskId)) day.tasks.set(t.taskId, { title: t.title, type: t.type, ordering: t.ordering })
        }
      }
    }
    return [...days.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ordering, d]) => ({
        ordering,
        name: d.name,
        tasks: [...d.tasks.entries()]
          .map(([taskId, t]) => ({ taskId, ...t }))
          .sort((a, b) => a.ordering - b.ordering),
      }))
  }, [members])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q),
    )
  }, [members, search])

  if (members.length === 0) {
    return <p className="text-sm text-zinc-400">No one has joined the challenge cohort yet.</p>
  }

  const memberCountLabel =
    filteredMembers.length === members.length
      ? `${members.length}`
      : `${filteredMembers.length} of ${members.length}`

  return (
    <div className="space-y-8">
      {/* ── Cohort progress by day ──────────────────────────────────────── */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Cohort progress by day
        </h2>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {cohortDays.map((d) => {
            // Headline = people completion rate: what share of members finished
            // every task in the day. This is the "are they clearing it?" signal.
            const completedPct = d.memberCount ? Math.round((d.fullyCompleted / d.memberCount) * 100) : 0
            return (
              <div key={d.ordering} className="min-w-[150px] flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                <div className="text-sm font-semibold text-zinc-900">{d.name}</div>
                <div className="mt-0.5 text-[11px] text-zinc-400">{d.totalTasks} tasks</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-xl font-bold text-zinc-900">{completedPct}%</span>
                  <span className="text-[11px] text-zinc-400">completed</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={completedPct} />
                </div>
                <div className="mt-2 text-[11px] text-zinc-500">
                  {d.fullyCompleted}/{d.memberCount} people · {d.started} started
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-400">
                  {d.avgPct}% avg task progress
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Members ─────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Members</h2>
          {/* View toggle */}
          <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
            {([
              ['matrix', 'Day-by-day'],
              ['detail', 'Detailed'],
              ['pace', 'Pace'],
              ['questions', 'By question'],
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

        {view === 'questions' ? (
          <ChallengeQuestionsView days={taskCatalog} />
        ) : view === 'pace' ? (
          <ChallengePaceTable members={members} calendarDates={calendarDates} />
        ) : view === 'matrix' ? (
          <ChallengeMatrixTable
            members={members}
            cohortDays={cohortDays}
            onOpenDay={(email, ordering) => {
              setSearch('')
              setView('detail')
              setOpenMember(email)
              setOpenDay(`${email}:${ordering}`)
            }}
          />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3">
              <div className="relative">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                >
                  <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or email…"
                  className="w-56 rounded-lg border border-zinc-300 bg-white py-1.5 pl-8 pr-3 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
                />
              </div>
              <span className="whitespace-nowrap text-xs font-medium text-zinc-500">{memberCountLabel}</span>
            </div>

            {filteredMembers.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center">
                <p className="text-sm text-zinc-400">No members match “{search}”.</p>
              </div>
            ) : (
              <DetailView
                members={filteredMembers}
                openMember={openMember}
                setOpenMember={setOpenMember}
                openDay={openDay}
                setOpenDay={setOpenDay}
                onOpenThread={setThread}
              />
            )}
          </>
        )}
      </section>

      {thread && (
        <ConversationThreadModal
          title={thread.title}
          subtitle={thread.subtitle}
          messages={thread.messages}
          description={thread.description}
          scorecard={thread.scorecard}
          onClose={() => setThread(null)}
        />
      )}
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
  onOpenThread,
}: {
  members: Member[]
  openMember: string | null
  setOpenMember: (v: string | null) => void
  openDay: string | null
  setOpenDay: (v: string | null) => void
  onOpenThread: (t: ThreadView) => void
}) {
  // When a day is opened (incl. via a matrix cell click), scroll it into view.
  const openDayRef = useRef<HTMLDivElement | null>(null)
  // Currently-expanded task within the open member, keyed `${email}:${taskId}`.
  const [openTask, setOpenTask] = useState<string | null>(null)
  useEffect(() => {
    if (!openDay) return
    const el = openDayRef.current
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }, [openDay])

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200">
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      {/* Header (frozen) */}
      <div
        className="sticky top-0 z-10 grid items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
        style={{ gridTemplateColumns: ROW_COLS }}
      >
        <span>Member</span>
        <span>Progress</span>
        <span className="text-right">Started</span>
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
              <div className="text-right">
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
                    <div
                      key={d.ordering}
                      ref={dayOpen ? openDayRef : undefined}
                      className="scroll-mt-24 rounded-lg border border-zinc-200 bg-white"
                    >
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
                        <div className="border-t border-zinc-100 px-3 py-2">
                          {d.tasks.map((t) => {
                            const isQuiz = t.type === 'quiz'
                            const taskKey = `${m.email}:${t.taskId}`
                            const taskOpen = isQuiz && openTask === taskKey
                            return (
                              <div key={t.taskId}>
                                <button
                                  type="button"
                                  disabled={!isQuiz}
                                  onClick={() => isQuiz && setOpenTask(taskOpen ? null : taskKey)}
                                  className={`flex w-full items-center gap-2.5 py-1 text-left ${isQuiz ? 'cursor-pointer hover:bg-zinc-50' : 'cursor-default'}`}
                                >
                                  {isQuiz ? (
                                    <Chevron open={taskOpen} />
                                  ) : (
                                    <span className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  )}
                                  <span className={`flex-1 truncate text-sm ${t.state === 'completed' ? 'text-zinc-700' : 'text-zinc-500'}`}>
                                    {t.title}
                                  </span>
                                  {isQuiz && (
                                    <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400">quiz</span>
                                  )}
                                  <span className={`w-20 shrink-0 text-right text-[11px] font-medium ${STATE_TEXT[t.state]}`}>{STATE_LABEL[t.state]}</span>
                                </button>

                                {taskOpen && (
                                  <div className="mb-2 ml-6 mt-1 rounded-lg border border-zinc-200 bg-zinc-50/70 p-2">
                                    <LearnerTaskQuestions
                                      email={m.email}
                                      taskId={t.taskId}
                                      learnerName={m.name}
                                      taskTitle={t.title}
                                      onOpenThread={onOpenThread}
                                    />
                                  </div>
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
            )}
          </div>
        )
      })}
      </div>
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
