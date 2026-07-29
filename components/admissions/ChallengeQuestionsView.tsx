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
import EvalTagger from '@/components/evals/EvalTagger'
import { getGradingEvals } from '@/app/(protected)/admissions/challenge/evals'
import { usePersistentState } from '@/hooks/usePersistentState'
import { EVAL_CONTEXT_SCREENING, computeEvalStats, symptomLabel, type GradingEval } from '@/lib/evals'

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

// Key for one attempt's label: question + learner + attempt timestamp.
const labelKey = (questionId: string, email: string, attemptAt: string) => `${questionId}||${email}||${attemptAt}`

export default function ChallengeQuestionsView({ days }: { days: TaskCatalogDay[] }) {
  const [openDay, setOpenDay] = usePersistentState<number | null>(
    'admissions-challenge-questions:open-day',
    days[0]?.ordering ?? null,
    { validate: (value): value is number | null => value == null || typeof value === 'number' },
  )
  const [openTask, setOpenTask] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Record<string, TaskQuestion[] | 'loading' | 'error'>>({})
  const [selected, setSelected] = useState<{ questionId: string; title: string; taskTitle: string } | null>(null)
  // All grading-eval labels for the screening context, keyed per attempt — drives
  // both the overall accuracy banner and each question's live stats.
  const [labels, setLabels] = useState<Record<string, GradingEval>>({})

  useEffect(() => {
    let cancelled = false
    getGradingEvals(EVAL_CONTEXT_SCREENING)
      .then((rows) => {
        if (!cancelled) setLabels(Object.fromEntries(rows.map((r) => [labelKey(r.questionId, r.learnerEmail, r.attemptAt), r])))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const overall = computeEvalStats(Object.values(labels))
  function onSaved(e: GradingEval) {
    setLabels((prev) => ({ ...prev, [labelKey(e.questionId, e.learnerEmail, e.attemptAt)]: e }))
  }

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
    <div className="space-y-3">
      {/* Overall grader accuracy across everything labeled so far. */}
      {overall.total > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
          <span className="font-semibold text-zinc-800">Overall grader accuracy</span>
          <span className={`text-lg font-bold ${overall.accuracyPct! >= 80 ? 'text-emerald-600' : overall.accuracyPct! >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {overall.accuracyPct}%
          </span>
          <span className="text-xs text-zinc-400">
            {overall.correct} right · {overall.incorrect} wrong · {overall.total} responses labeled
          </span>
          {Object.entries(overall.bySymptom)
            .sort((a, b) => b[1] - a[1])
            .map(([k, n]) => (
              <span key={k} className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">{symptomLabel(k)} ×{n}</span>
            ))}
        </div>
      )}

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
          <QuestionAnswers
            key={selected.questionId}
            questionId={selected.questionId}
            title={selected.title}
            taskTitle={selected.taskTitle}
            labels={labels}
            onSaved={onSaved}
          />
        ) : (
          <div className="flex h-full min-h-[300px] items-center justify-center px-6 text-center">
            <p className="text-sm text-zinc-400">Select a question on the left to see how every learner answered it.</p>
          </div>
        )}
      </div>
    </div>
    </div>
  )
}

function QuestionAnswers({
  questionId,
  title,
  taskTitle,
  labels,
  onSaved,
}: {
  questionId: string
  title: string
  taskTitle: string
  labels: Record<string, GradingEval>
  onSaved: (e: GradingEval) => void
}) {
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
  // Per-question stats = this question's slice of the shared label map.
  const stats = computeEvalStats(Object.values(labels).filter((l) => l.questionId === questionId))

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
        {stats.total > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            <span className="font-semibold text-zinc-700">
              Grader accuracy: <span className={stats.accuracyPct! >= 80 ? 'text-emerald-600' : stats.accuracyPct! >= 50 ? 'text-amber-600' : 'text-red-600'}>{stats.accuracyPct}%</span>
            </span>
            <span className="text-zinc-400">{stats.correct} right · {stats.incorrect} wrong · {stats.total} labeled</span>
            {Object.entries(stats.bySymptom)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => (
                <span key={k} className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{symptomLabel(k)} ×{n}</span>
              ))}
          </div>
        )}
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
            {answers.map((a, i) => {
              // Every attempt is independently taggable, keyed by its timestamp.
              const email = (a.email ?? '').trim().toLowerCase()
              const key = labelKey(questionId, email, a.at)
              return (
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
                  {email && (
                    <div className="mt-2.5">
                      <EvalTagger
                        context={EVAL_CONTEXT_SCREENING}
                        questionId={questionId}
                        learnerEmail={email}
                        attemptAt={a.at}
                        aiScore={a.score}
                        aiFeedback={a.feedback}
                        scorecardSnapshot={data?.scorecard?.length ? JSON.stringify(data.scorecard) : null}
                        preloaded
                        initial={labels[key] ?? null}
                        onSaved={onSaved}
                      />
                    </div>
                  )}
                </li>
              )
            })}
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
