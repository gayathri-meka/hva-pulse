'use client'

import { useState, useTransition } from 'react'
import { fetchQuestionThread, type ChatMessage } from '@/app/(protected)/learning/deep-dive/actions'

interface Props {
  learner: {
    name: string
    email: string
    batch_name: string | null
    lf_name: string | null
    status: string | null
  }
  analysisText: string | null
  rawData: unknown
  computedAt: string
}

const STATUS_BADGE: Record<string, string> = {
  Ongoing:         'bg-emerald-100 text-emerald-700',
  'On Hold':       'bg-orange-100 text-orange-700',
  Dropout:         'bg-red-100 text-red-700',
  Discontinued:    'bg-zinc-200 text-zinc-600',
  'Placed - Self': 'bg-blue-100 text-blue-700',
  'Placed - HVA':  'bg-violet-100 text-violet-700',
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function LearnerAnalysisView({ learner, analysisText, rawData, computedAt }: Props) {
  const [showRaw, setShowRaw] = useState(false)
  const [thread, setThread]   = useState<{ title: string; course: string; messages: ChatMessage[] } | null>(null)
  const [threadLoading, startThread] = useTransition()

  function viewThread(questionTitle: string, courseName: string) {
    startThread(async () => {
      try {
        const messages = await fetchQuestionThread(learner.email, questionTitle, courseName)
        setThread({ title: questionTitle, course: courseName, messages })
      } catch (e) {
        console.error(e)
      }
    })
  }
  const initials = learner.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  const rd = rawData as {
    course_summary?: Record<string, string>[]
    weakest_areas?: Record<string, string>[]
    score_progressions?: Record<string, string>[]
    feedback_samples?: Record<string, string>[]
    activity_timeline?: Record<string, string>[]
  } | null

  return (
    <div className="space-y-6">
      {/* Learner info card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-500">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">{learner.name}</h2>
              <p className="text-sm text-zinc-500">{learner.email}</p>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-400">
                {learner.batch_name && <span>{learner.batch_name}</span>}
                {learner.lf_name && <span>LF: {learner.lf_name}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {learner.status && (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[learner.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                {learner.status}
              </span>
            )}
            <span className="text-[10px] text-zinc-400">Analysis from {fmtDate(computedAt)}</span>
          </div>
        </div>
      </div>

      {/* Analysis text — rendered as markdown-ish sections */}
      {analysisText && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <AnalysisMarkdown text={analysisText} />
        </div>
      )}

      {!analysisText && (
        <div className="rounded-xl border border-zinc-200 px-8 py-12 text-center">
          <p className="text-sm text-zinc-400">Analysis text not yet generated for this learner.</p>
        </div>
      )}

      {/* Raw data toggle */}
      {rd && (
        <div>
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs text-zinc-400 hover:text-zinc-600"
          >
            {showRaw ? 'Hide raw data' : 'Show raw data'}
          </button>

          {showRaw && (
            <div className="mt-3 space-y-4">
              <RawSection title="Course Summary" rows={rd.course_summary} columns={['course_name', 'question_type', 'first_attempt_pass_rate', 'avg_first_score', 'retries', 'distinct_questions']} />
              <RawSection title="Weakest Areas" rows={rd.weakest_areas?.slice(0, 15)} columns={['course_name', 'milestone_name', 'first_pass_rate', 'avg_first_score', 'questions']} />
              <ProgressionSection
                rows={rd.score_progressions?.slice(0, 20)}
                onViewThread={viewThread}
                loading={threadLoading}
              />
              <RawSection title="AI Feedback Samples" rows={rd.feedback_samples?.slice(0, 15)} columns={['course_name', 'question_title', 'score', 'wrong_feedback']} />
            </div>
          )}
        </div>
      )}

      {/* Chat thread modal */}
      {thread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900">{thread.title}</h2>
                <p className="text-xs text-zinc-400">{thread.course} · {thread.messages.length} messages</p>
              </div>
              <button onClick={() => setThread(null)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto p-6 space-y-4" style={{ maxHeight: 'calc(90vh - 70px)' }}>
              {thread.messages.map((msg, i) => (
                <div key={i} className={`rounded-xl p-4 ${msg.role === 'user' ? 'bg-zinc-50 border border-zinc-200' : 'bg-blue-50 border border-blue-100'}`}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${msg.role === 'user' ? 'text-zinc-500' : 'text-blue-600'}`}>
                      {msg.role === 'user' ? 'Learner' : 'AI Feedback'}
                    </span>
                    {msg.score && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        msg.score.startsWith('4/4') ? 'bg-emerald-100 text-emerald-700'
                        : msg.score.startsWith('3/') ? 'bg-amber-100 text-amber-700'
                        : msg.score.startsWith('1/') ? 'bg-red-100 text-red-700'
                        : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {msg.score}
                      </span>
                    )}
                  </div>

                  {msg.role === 'user' ? (
                    <pre className="whitespace-pre-wrap text-xs font-mono text-zinc-700 leading-relaxed">{msg.content}</pre>
                  ) : (
                    <div className="space-y-2 text-sm text-zinc-700">
                      <p>{msg.content}</p>
                      {msg.feedback_correct && (
                        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                          <span className="font-semibold">Correct: </span>{msg.feedback_correct}
                        </div>
                      )}
                      {msg.feedback_wrong && (
                        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                          <span className="font-semibold">Wrong: </span>{msg.feedback_wrong}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {thread.messages.length === 0 && (
                <p className="text-center text-sm text-zinc-400 py-8">No conversation data found for this question.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {threadLoading && !thread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="rounded-xl bg-white px-6 py-4 shadow-xl">
            <p className="text-sm text-zinc-600">Loading conversation from BigQuery...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Markdown-style renderer ──────────────────────────────────────────────────

function AnalysisMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="mt-5 mb-2 text-sm font-bold text-zinc-900 first:mt-0">
          {line.slice(3)}
        </h3>
      )
    } else if (line.startsWith('- ')) {
      elements.push(
        <div key={i} className="ml-3 flex gap-2 py-0.5 text-sm text-zinc-700">
          <span className="shrink-0 text-zinc-300">•</span>
          <span dangerouslySetInnerHTML={{ __html: formatInline(line.slice(2)) }} />
        </div>
      )
    } else if (line.trim() === '') {
      // skip blank lines
    } else {
      elements.push(
        <p key={i} className="text-sm text-zinc-600 leading-relaxed">
          <span dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        </p>
      )
    }
  }

  return <div>{elements}</div>
}

function formatInline(text: string): string {
  // Bold: **text** → <strong>
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-zinc-900">$1</strong>')
  // Code: `text` → <code>
  html = html.replace(/`(.+?)`/g, '<code class="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-mono text-zinc-700">$1</code>')
  // Warning emoji
  html = html.replace(/⚠️/g, '<span class="text-amber-500">⚠️</span>')
  html = html.replace(/⚡/g, '<span class="text-amber-400">⚡</span>')
  return html
}

// ── Score progressions with "View" button ────────────────────────────────────

function ProgressionSection({ rows, onViewThread, loading }: {
  rows?: Record<string, string>[]
  onViewThread: (questionTitle: string, courseName: string) => void
  loading: boolean
}) {
  if (!rows || rows.length === 0) return null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Score Progressions (3+ attempts)</p>
        <p className="text-[10px] text-zinc-400">{rows.length} questions · click "View" to see the full conversation</p>
      </div>
      <div className="divide-y divide-zinc-50">
        {rows.map((row, i) => {
          const prog = row.score_progression ?? ''
          const parts = prog.split(' -> ')
          return (
            <div key={i} className="px-4 py-2.5 hover:bg-zinc-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-zinc-800">{row.question_title}</p>
                  <p className="text-[10px] text-zinc-400">{row.course_name} · {row.total_attempts} attempts</p>
                </div>
                <button
                  onClick={() => onViewThread(row.question_title ?? '', row.course_name ?? '')}
                  disabled={loading}
                  className="shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
                >
                  {loading ? '…' : 'View'}
                </button>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {parts.map((score, j) => {
                  const [num, den] = score.split('/')
                  const ratio = den ? parseFloat(num) / parseFloat(den) : 0
                  const bg = ratio >= 0.9 ? 'bg-emerald-100 text-emerald-700'
                           : ratio >= 0.7 ? 'bg-amber-100 text-amber-700'
                           : 'bg-red-100 text-red-700'
                  return (
                    <span key={j} className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${bg}`}>
                      {score}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Raw data table ───────────────────────────────────────────────────────────

function RawSection({ title, rows, columns }: {
  title: string
  rows?: Record<string, string>[]
  columns: string[]
}) {
  if (!rows || rows.length === 0) return null

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
      <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
        <p className="text-[10px] text-zinc-400">{rows.length} rows</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50">
              {columns.map((col) => (
                <th key={col} className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-zinc-50">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-zinc-600 max-w-xs truncate" title={row[col] ?? ''}>
                    {row[col] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
