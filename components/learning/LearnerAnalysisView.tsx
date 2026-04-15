'use client'

import { useState } from 'react'

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
              <RawSection title="Score Progressions (3+ attempts)" rows={rd.score_progressions?.slice(0, 20)} columns={['course_name', 'question_title', 'score_progression', 'total_attempts']} />
              <RawSection title="AI Feedback Samples" rows={rd.feedback_samples?.slice(0, 15)} columns={['course_name', 'question_title', 'score', 'wrong_feedback']} />
            </div>
          )}
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
