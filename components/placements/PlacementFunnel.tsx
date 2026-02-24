'use client'

import Link from 'next/link'

interface Props {
  totalRoles:        number
  totalApplications: number
  shortlisted:       number
  hired:             number
  rejected:          number
  not_shortlisted:   number
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

// ─── Arrow ──────────────────────────────────────────────────────────────────
function Arrow() {
  return (
    <div className="flex justify-center py-1 text-zinc-300">
      <svg width="14" height="24" viewBox="0 0 14 24" fill="none">
        <line x1="7" y1="0" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 14l6 8 6-8" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Arrow with dropout branch to the right ──────────────────────────────────
function ArrowWithDropout({
  count,
  total,
  pctLabel,
  label,
  href,
  cardBg,
  cardBorder,
  labelCls,
  countCls,
  metaCls,
  dividerCls,
}: {
  count:       number
  total:       number
  pctLabel:    string
  label:       string
  href:        string
  cardBg:      string
  cardBorder:  string
  labelCls:    string
  countCls:    string
  metaCls:     string
  dividerCls:  string
}) {
  return (
    <div className="flex items-center">
      {/* Left spacer — mirrors right side so arrow stays centered */}
      <div className="flex-1" />

      {/* Center: downward arrow */}
      <div className="flex flex-col items-center px-8 py-1">
        <Arrow />
      </div>

      {/* Right: dropout branch */}
      <div className="flex flex-1 items-center gap-3 py-1">
        <div className={`h-px w-8 shrink-0 ${dividerCls}`} />
        <Link
          href={href}
          className={`block rounded-xl border ${cardBorder} ${cardBg} px-4 py-3 transition-opacity hover:opacity-75`}
        >
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${labelCls}`}>
            {label}
          </p>
          <p className={`mt-0.5 text-2xl font-bold tabular-nums ${countCls}`}>{count}</p>
          <p className={`mt-0.5 text-xs ${metaCls}`}>{pct(count, total)} {pctLabel}</p>
        </Link>
      </div>
    </div>
  )
}

// ─── Funnel stage ─────────────────────────────────────────────────────────────
interface StageProps {
  label:      string
  count:      number
  metaLabel?: string
  metaValue?: string
  href:       string
  bg:         string
  border:     string
  accent:     string
  countColor: string
  widthClass: string
}

function FunnelStage({
  label, count, metaLabel, metaValue, href,
  bg, border, accent, countColor, widthClass,
}: StageProps) {
  return (
    <Link
      href={href}
      className={`mx-auto block ${widthClass} rounded-xl border ${border} ${bg} px-6 py-4 transition-opacity hover:opacity-75`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${accent}`}>
            {label}
          </p>
          <p className={`mt-1 text-3xl font-bold tabular-nums ${countColor}`}>{count}</p>
        </div>
        {metaLabel && metaValue && (
          <div className="text-right">
            <p className="text-xs text-zinc-400">{metaLabel}</p>
            <p className="text-xl font-semibold text-zinc-600">{metaValue}</p>
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Funnel ───────────────────────────────────────────────────────────────────
export default function PlacementFunnel({
  totalRoles,
  totalApplications,
  shortlisted,
  hired,
  rejected,
  not_shortlisted,
}: Props) {
  const shortlistRate = pct(shortlisted, totalApplications)
  const hireRate      = pct(hired, shortlisted)

  return (
    <div className="mx-auto max-w-xl">

      {/* Roles */}
      <FunnelStage
        label="Roles posted"
        count={totalRoles}
        href="/placements/companies"
        bg="bg-zinc-50"
        border="border-zinc-200"
        accent="text-zinc-500"
        countColor="text-zinc-900"
        widthClass="w-full"
      />

      <Arrow />

      {/* Applications */}
      <FunnelStage
        label="Applications"
        count={totalApplications}
        href="/placements/applications"
        bg="bg-blue-50"
        border="border-blue-100"
        accent="text-blue-500"
        countColor="text-blue-900"
        widthClass="w-full"
      />

      {/* Dropout branch 1: Not shortlisted (Applications → Shortlisted) */}
      <ArrowWithDropout
        count={not_shortlisted}
        total={totalApplications}
        pctLabel="of applications"
        label="Not Shortlisted"
        href="/placements/applications?status=not_shortlisted"
        cardBg="bg-zinc-50"
        cardBorder="border-zinc-200"
        labelCls="text-zinc-400"
        countCls="text-zinc-700"
        metaCls="text-zinc-400"
        dividerCls="bg-zinc-200"
      />

      {/* Shortlisted */}
      <FunnelStage
        label="Shortlisted"
        count={shortlisted}
        metaLabel="shortlist rate"
        metaValue={shortlistRate}
        href="/placements/applications?status=shortlisted"
        bg="bg-amber-50"
        border="border-amber-100"
        accent="text-amber-500"
        countColor="text-amber-900"
        widthClass="w-[82%]"
      />

      {/* Dropout branch 2: Rejected (Shortlisted → Hired) */}
      <ArrowWithDropout
        count={rejected}
        total={shortlisted}
        pctLabel="of shortlisted"
        label="Rejected"
        href="/placements/applications?status=rejected"
        cardBg="bg-red-50"
        cardBorder="border-red-100"
        labelCls="text-red-400"
        countCls="text-red-700"
        metaCls="text-red-400"
        dividerCls="bg-red-200"
      />

      {/* Hired */}
      <FunnelStage
        label="Hired"
        count={hired}
        metaLabel="hire rate"
        metaValue={hireRate}
        href="/placements/applications?status=hired"
        bg="bg-emerald-50"
        border="border-emerald-100"
        accent="text-emerald-500"
        countColor="text-emerald-900"
        widthClass="w-[62%]"
      />

    </div>
  )
}
