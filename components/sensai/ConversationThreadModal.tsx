'use client'

import { type ChatMessage, type ScorecardCategory, scoreBadgeClass } from '@/lib/sensaiChat'
import QuestionContext from './QuestionContext'

// Shared modal that renders a learner ↔ AI-grader conversation pulled from
// sensai chat_history. Used by Learning → Deep Dive and Admissions → Challenge.

export default function ConversationThreadModal({
  title,
  subtitle,
  messages,
  description,
  scorecard,
  loading,
  onClose,
}: {
  title: string
  subtitle?: string
  messages: ChatMessage[]
  description?: string
  scorecard?: ScorecardCategory[]
  loading?: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-900">{title}</h2>
            <p className="text-xs text-zinc-400">
              {subtitle ? `${subtitle} · ` : ''}
              {messages.length} messages
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-4" style={{ maxHeight: 'calc(90vh - 70px)' }}>
          <QuestionContext description={description} scorecard={scorecard} />
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-xl p-4 ${
                msg.role === 'user' ? 'bg-zinc-50 border border-zinc-200' : 'bg-blue-50 border border-blue-100'
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    msg.role === 'user' ? 'text-zinc-500' : 'text-blue-600'
                  }`}
                >
                  {msg.role === 'user' ? 'Learner' : 'AI Feedback'}
                </span>
                {msg.score && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${scoreBadgeClass(msg.score, msg.correct)}`}>
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
                      <span className="font-semibold">Correct: </span>
                      {msg.feedback_correct}
                    </div>
                  )}
                  {msg.feedback_wrong && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
                      <span className="font-semibold">Wrong: </span>
                      {msg.feedback_wrong}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {!loading && messages.length === 0 && (
            <p className="py-8 text-center text-sm text-zinc-400">No conversation data found for this question.</p>
          )}
          {loading && (
            <p className="py-8 text-center text-sm text-zinc-400">Loading conversation from BigQuery…</p>
          )}
        </div>
      </div>
    </div>
  )
}
