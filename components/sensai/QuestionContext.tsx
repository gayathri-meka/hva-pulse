'use client'

import type { ScorecardCategory } from '@/lib/sensaiChat'

// The question prompt + grading rubric for a sensai question. Shown above the
// answers in the By-question panel and inside the per-learner conversation modal.

export default function QuestionContext({
  description,
  scorecard,
}: {
  description?: string
  scorecard?: ScorecardCategory[]
}) {
  const hasScorecard = !!scorecard && scorecard.length > 0
  if (!description && !hasScorecard) return null

  return (
    <div className="space-y-3">
      {description && (
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Question</p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-700">{description}</p>
        </div>
      )}

      {hasScorecard && (
        <div className="rounded-lg border border-zinc-200 bg-white p-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Scorecard</p>
          <div className="space-y-2">
            {scorecard!.map((c, i) => (
              <div key={i}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-zinc-800">{c.name}</span>
                  <span className="shrink-0 text-[10px] text-zinc-400">
                    {c.maxScore != null && `max ${c.maxScore}`}
                    {c.passScore != null && ` · pass ${c.passScore}`}
                  </span>
                </div>
                {c.description && (
                  <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-500">{c.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
