'use client'

import { useEffect, useState } from 'react'
import {
  getTaskQuestions,
  getQuestionAnswers,
  type TaskQuestion,
  type QuestionDetail,
} from '@/app/(protected)/admissions/challenge/actions'
import { scoreBadgeClass } from '@/lib/sensaiChat'
import QuestionContext from '@/components/sensai/QuestionContext'

export type TaskCatalogDay = {
  ordering: number
  name: string
  tasks: { taskId: string; title: string; type: string; ordering: number }[]
}

// Feature 2 — cross-learner view. Left: days → tasks → questions (questions are
// lazy-loaded from BigQuery when a quiz task is expanded). Right: every recent
// answer the selected question got from all learners.

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

export default function ChallengeQuestionsView({ days }: { days: TaskCatalogDay[] }) {
  const [openDay, setOpenDay] = useState<number | null>(days[0]?.ordering ?? null)
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Record<string, TaskQuestion[] | 'loading' | 'error'>>({})
  const [selected, setSelected] = useState<{ questionId: string; title: string; taskTitle: string } | null>(null)

  function toggleTask(taskId: string) {
    const next = openTask === taskId ? null : taskId
    setOpenTask(next)
    if (next && !questions[next]) {
      setQuestions((q) => ({ ...q, [next]: 'loading' }))
      getTaskQuestions(next)
        .then((rows) => setQuestions((q) => ({ ...q, [next]: rows })))
        .catch((e) => {
          console.error(e)
          setQuestions((q) => ({ ...q, [next]: 'error' }))
        })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {/* ── Left: day → task → question tree ─────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="max-h-[calc(100vh-220px)] overflow-auto">
          {days.map((d) => {
            const dayOpen = openDay === d.ordering
            return (
              <div key={d.ordering} className="border-b border-zinc-100 last:border-b-0">
                <button
                  onClick={() => setOpenDay(dayOpen ? null : d.ordering)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50"
                >
                  <Chevron open={dayOpen} />
                  <span className="text-sm font-semibold text-zinc-800">{d.name}</span>
                  <span className="ml-auto text-[11px] text-zinc-400">{d.tasks.length} tasks</span>
                </button>

                {dayOpen && (
                  <div className="pb-1.5">
                    {d.tasks.map((t) => {
                      const isQuiz = t.type === 'quiz'
                      const taskOpen = openTask === t.taskId
                      const qs = questions[t.taskId]
                      return (
                        <div key={t.taskId} className="ml-4">
                          <button
                            type="button"
                            disabled={!isQuiz}
                            onClick={() => isQuiz && toggleTask(t.taskId)}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${isQuiz ? 'hover:bg-zinc-50' : 'cursor-default'}`}
                          >
                            {isQuiz ? (
                              <Chevron open={taskOpen} />
                            ) : (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-200" />
                            )}
                            <span className={`flex-1 truncate text-xs ${isQuiz ? 'text-zinc-700' : 'text-zinc-400'}`}>
                              {t.title}
                            </span>
                            {isQuiz && (
                              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-400">quiz</span>
                            )}
                          </button>

                          {taskOpen && (
                            <div className="ml-5 border-l border-zinc-100 pl-2">
                              {qs === 'loading' && <p className="px-2 py-1.5 text-[11px] text-zinc-400">Loading…</p>}
                              {qs === 'error' && <p className="px-2 py-1.5 text-[11px] text-red-500">Failed to load.</p>}
                              {Array.isArray(qs) && qs.length === 0 && (
                                <p className="px-2 py-1.5 text-[11px] text-zinc-400">No questions.</p>
                              )}
                              {Array.isArray(qs) &&
                                qs.map((q) => {
                                  const isSel = selected?.questionId === q.questionId
                                  return (
                                    <button
                                      key={q.questionId}
                                      onClick={() => setSelected({ questionId: q.questionId, title: q.title, taskTitle: t.title })}
                                      className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs ${
                                        isSel ? 'bg-[#E1F5EE] text-[#085041]' : 'text-zinc-600 hover:bg-zinc-50'
                                      }`}
                                    >
                                      <span className="truncate">{q.title}</span>
                                      <span className="ml-auto shrink-0 text-[9px] uppercase tracking-wide text-zinc-300">{q.type}</span>
                                    </button>
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

      {/* ── Right: answers for the selected question ─────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        {selected ? (
          <QuestionAnswers key={selected.questionId} questionId={selected.questionId} title={selected.title} taskTitle={selected.taskTitle} />
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center px-6 text-center">
            <p className="text-sm text-zinc-400">Select a question on the left to see how every learner answered it.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function QuestionAnswers({ questionId, title, taskTitle }: { questionId: string; title: string; taskTitle: string }) {
  const [data, setData] = useState<QuestionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    getQuestionAnswers(questionId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setError('Could not load answers from BigQuery.')
      })
    return () => {
      cancelled = true
    }
  }, [questionId])

  const answers = data?.answers

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900">{title}</p>
          {data?.type && (
            <span className="rounded bg-zinc-200/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-zinc-500">
              {data.type}
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-400">
          {taskTitle}
          {answers ? ` · ${answers.length} recent answers` : ''}
        </p>
      </div>
      <div className="max-h-[calc(100vh-270px)] overflow-auto p-3">
        {error && <p className="px-1 py-2 text-xs text-red-500">{error}</p>}
        {!data && !error && <p className="px-1 py-2 text-xs text-zinc-400">Loading from BigQuery…</p>}

        {data && (
          <div className="mb-3">
            <QuestionContext description={data.description} scorecard={data.scorecard} />
          </div>
        )}

        {answers && answers.length === 0 && <p className="px-1 py-2 text-xs text-zinc-400">No answers yet.</p>}
        {answers && answers.length > 0 && (
          <ul className="space-y-2">
            {answers.map((a, i) => (
              <li key={i} className="rounded-lg border border-zinc-200 p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-zinc-800">{a.name}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.score && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${scoreBadgeClass(a.score, a.correct)}`}>
                        {a.score}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400">{fmtTs(a.at)}</span>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap break-words text-xs font-mono text-zinc-700">{a.answer || '—'}</pre>
                {a.feedback && <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">{a.feedback}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function fmtTs(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
