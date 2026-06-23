'use client'

import { useState, useTransition } from 'react'
import { fetchQuestionThread } from '@/app/(protected)/learning/deep-dive/actions'
import type { ChatMessage } from '@/lib/sensaiChat'
import ConversationThreadModal from '@/components/sensai/ConversationThreadModal'

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
  const rd = rawData as {
    course_summary?: Record<string, string>[]
    weakest_areas?: Record<string, string>[]
    score_progressions?: Record<string, string>[]
    feedback_samples?: Record<string, string>[]
    activity_timeline?: Record<string, string>[]
  } | null

  return (
    <div className="space-y-6">
      {/* Analysis text — rendered as markdown-ish sections */}
      {analysisText && (
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="mb-3 text-[10px] text-zinc-400">Analysis from {fmtDate(computedAt)}</p>
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
        <ConversationThreadModal
          title={thread.title}
          subtitle={thread.course}
          messages={thread.messages}
          onClose={() => setThread(null)}
        />
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
