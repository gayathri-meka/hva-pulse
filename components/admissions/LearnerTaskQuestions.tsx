'use client'

import { useEffect, useState } from 'react'
import { getLearnerTaskDetail, type LearnerQuestionThread } from '@/app/(protected)/admissions/challenge/actions'
import { scoreBadgeClass } from '@/lib/sensaiChat'
import type { ThreadView } from './ChallengeClient'

// Feature 1 — when a quiz task is expanded for one learner, load every question
// in that task with the learner's score progression + full conversation (live
// from BigQuery). Mirrors the Learning deep-dive raw-data drill-down.

export default function LearnerTaskQuestions({
  email,
  taskId,
  learnerName,
  taskTitle,
  onOpenThread,
}: {
  email: string
  taskId: string
  learnerName: string
  taskTitle: string
  onOpenThread: (t: ThreadView) => void
}) {
  const [data, setData] = useState<LearnerQuestionThread[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    getLearnerTaskDetail(email, taskId)
      .then((rows) => {
        if (!cancelled) setData(rows)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) setError('Could not load conversation data from BigQuery.')
      })
    return () => {
      cancelled = true
    }
  }, [email, taskId])

  if (error) return <p className="px-1 py-2 text-xs text-red-500">{error}</p>
  if (!data) return <p className="px-1 py-2 text-xs text-zinc-400">Loading from BigQuery…</p>
  if (data.length === 0) return <p className="px-1 py-2 text-xs text-zinc-400">This task has no questions.</p>

  return (
    <div className="divide-y divide-zinc-100">
      {data.map((q) => {
        // Score progression = the grader's score on each attempt, in order.
        const scores = q.messages.filter((m) => m.role === 'assistant')
        const answered = scores.length > 0
        return (
          <div key={q.questionId} className="flex items-start justify-between gap-3 px-1 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-800">{q.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {answered ? (
                  scores.map((m, j) => (
                    <span
                      key={j}
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${scoreBadgeClass(m.score, m.correct)}`}
                    >
                      {m.score ?? '–'}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-zinc-400">Not attempted</span>
                )}
              </div>
            </div>
            <button
              type="button"
              disabled={!answered}
              onClick={() =>
                onOpenThread({
                  title: q.title,
                  subtitle: `${learnerName} · ${taskTitle}`,
                  messages: q.messages,
                  description: q.description,
                  scorecard: q.scorecard,
                })
              }
              className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            >
              View
            </button>
          </div>
        )
      })}
    </div>
  )
}
