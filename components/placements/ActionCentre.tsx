'use client'

import { useState } from 'react'
import Link from 'next/link'

type AgeStats = { oldest: number; avg: number; buckets: { gt14: number; d7to14: number; d1to7: number } }

interface Props {
  awaitingShortlist:     number
  yetToStart:            number
  interviewsOngoing:     number
  totalApps:             number
  appliedAge?:           AgeStats
  shortlistedAge?:       AgeStats
  interviewsOngoingAge?: AgeStats
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

function oldestColor(days: number): string {
  if (days > 14) return 'text-red-500 font-medium'
  if (days > 7)  return 'text-amber-500 font-medium'
  return ''
}

// ─── Mini bar row inside breakdown ───────────────────────────────────────────
function BucketBar({
  label, count, max, barCls, countCls,
}: {
  label: string; count: number; max: number; barCls: string; countCls: string
}) {
  const width = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] text-zinc-400">{label}</span>
      <div className="flex flex-1 items-center gap-1.5">
        <div className="h-1.5 flex-1 rounded-full bg-zinc-100">
          <div className={`h-full rounded-full ${barCls}`} style={{ width: `${width}%` }} />
        </div>
        <span className={`w-4 shrink-0 text-right text-xs font-semibold tabular-nums ${countCls}`}>
          {count}
        </span>
      </div>
    </div>
  )
}

// ─── Individual action card ───────────────────────────────────────────────────
function ActionItem({
  count, pctStr, title, description, href,
  countColor, borderColor, bgColor, dotColor,
  age,
}: {
  count:       number
  pctStr:      string
  title:       string
  description: string
  href:        string
  countColor:  string
  borderColor: string
  bgColor:     string
  dotColor:    string
  age?:        AgeStats
}) {
  const [expanded, setExpanded] = useState(false)

  const showAge      = count > 0 && age != null
  const showExpander = showAge && (age.buckets.gt14 + age.buckets.d7to14 + age.buckets.d1to7) > 0
  const maxBucket    = age ? Math.max(age.buckets.gt14, age.buckets.d7to14, age.buckets.d1to7, 1) : 1

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-start gap-4">
        <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />

        <div className="min-w-0 flex-1">
          {/* Count + title */}
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold tabular-nums ${countColor}`}>{count}</p>
            <p className="text-sm font-semibold text-zinc-800">{title}</p>
          </div>

          {/* Pct + inline age */}
          <p className="mt-1 text-xs text-zinc-400">
            <span className={`font-semibold ${countColor}`}>{pctStr} of total</span>
            {showAge && (
              <>
                <span className="mx-1.5">·</span>
                <span className={oldestColor(age.oldest)}>oldest {age.oldest}d</span>
                <span className="mx-1.5">·</span>
                <span>avg {age.avg}d</span>
              </>
            )}
          </p>

          {/* Description */}
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>

          {/* Expand toggle */}
          {showExpander && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-[10px] font-medium text-zinc-400 transition-colors hover:text-zinc-600"
            >
              {expanded ? 'Hide breakdown ↑' : 'Show breakdown ↓'}
            </button>
          )}

          {/* Breakdown bars */}
          {expanded && age && (
            <div className="mt-3 space-y-2 border-t border-black/5 pt-3">
              <BucketBar label="> 14 days"  count={age.buckets.gt14}   max={maxBucket} barCls="bg-red-400"   countCls="text-red-600" />
              <BucketBar label="7–14 days"  count={age.buckets.d7to14} max={maxBucket} barCls="bg-amber-400" countCls="text-amber-600" />
              <BucketBar label="≤ 7 days"    count={age.buckets.d1to7}  max={maxBucket} barCls="bg-zinc-400"  countCls="text-zinc-600" />
            </div>
          )}
        </div>

        {/* Arrow link */}
        <Link
          href={href}
          className="mt-1 shrink-0 text-zinc-300 transition-colors hover:text-zinc-500"
          aria-label={title}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    </div>
  )
}

// ─── Action Centre ────────────────────────────────────────────────────────────
export default function ActionCentre({
  awaitingShortlist, yetToStart, interviewsOngoing, totalApps,
  appliedAge, shortlistedAge, interviewsOngoingAge,
}: Props) {
  const total = awaitingShortlist + yetToStart + interviewsOngoing

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-zinc-900">Action Centre</h2>
          {total > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">
              {total} pending
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">Items that need your attention</p>
      </div>

      <div className="space-y-3">
        <ActionItem
          count={awaitingShortlist}
          pctStr={pct(awaitingShortlist, totalApps)}
          title="applications need shortlisting"
          description="Candidates have applied but haven't been shortlisted or rejected yet. Review and update their status."
          href="/placements/applications?status=applied"
          countColor="text-blue-700"
          borderColor="border-blue-100"
          bgColor="bg-blue-50"
          dotColor="bg-blue-400"
          age={appliedAge}
        />
        <ActionItem
          count={yetToStart}
          pctStr={pct(yetToStart, totalApps)}
          title="shortlisted yet to start interviews"
          description="These candidates have been shortlisted but interviews haven't started yet. Follow up with the company."
          href="/placements/applications?status=shortlisted"
          countColor="text-amber-700"
          borderColor="border-amber-100"
          bgColor="bg-amber-50"
          dotColor="bg-amber-400"
          age={shortlistedAge}
        />
        <ActionItem
          count={interviewsOngoing}
          pctStr={pct(interviewsOngoing, totalApps)}
          title="interviews ongoing need an update"
          description="Interviews are in progress. Chase the company for an outcome — hired or rejected."
          href="/placements/applications?status=interviews_ongoing"
          countColor="text-violet-700"
          borderColor="border-violet-100"
          bgColor="bg-violet-50"
          dotColor="bg-violet-400"
          age={interviewsOngoingAge}
        />
      </div>
    </div>
  )
}
