'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotInterestedReasons from './NotInterestedReasons'

interface Props {
  totalRoles:     number
  notInterested:  number
  totalApps:      number
  notShortlisted: number
  stillApplied:   number
  shortlistPassed: number
  inProcess:      number
  hired:          number
  rejected:       number
  reasonCounts:   Record<string, number>
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-3">
      <div className="h-px flex-1 bg-zinc-200" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  )
}

// ─── Branch card ──────────────────────────────────────────────────────────────
interface BranchCard {
  label:        string
  count:        number
  pctStr?:      string
  href:         string
  cardBg:       string
  cardBorder:   string
  labelCls:     string
  countCls:     string
  metaCls:      string
  dividerCls:   string
  onWhyClick?:  () => void
}

// ─── Arrow with one or more dropout branches to the right ────────────────────
function ArrowWithBranches({ branches }: { branches: BranchCard[] }) {
  return (
    <div className="flex items-stretch py-0.5">
      {/* Left spacer — keeps arrow centred */}
      <div className="flex-1" />

      {/* Center: variable-height shaft + arrowhead */}
      <div className="flex flex-col items-center px-6">
        <div className="w-px flex-1 bg-zinc-300" />
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="mt-[-1px] shrink-0 text-zinc-300">
          <path d="M1 1l6 7 6-7" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Right: stacked branch cards */}
      <div className="flex flex-1 flex-col justify-center gap-1.5 py-0.5">
        {branches.map((b) => (
          <div key={b.label} className="flex items-start gap-2">
            <div className={`mt-3 h-px w-6 shrink-0 ${b.dividerCls}`} />
            <div className="flex flex-col gap-0.5">
              <Link
                href={b.href}
                className={`block rounded-lg border ${b.cardBorder} ${b.cardBg} px-3 py-2 transition-opacity hover:opacity-75`}
              >
                <p className={`text-[9px] font-semibold uppercase tracking-widest ${b.labelCls}`}>
                  {b.label}
                </p>
                <p className={`mt-0.5 text-base font-bold tabular-nums ${b.countCls}`}>{b.count}</p>
                {b.pctStr && (
                  <p className={`text-[10px] ${b.metaCls}`}>{b.pctStr}</p>
                )}
              </Link>
              {b.onWhyClick && (
                <button
                  onClick={b.onWhyClick}
                  className="self-end flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-500 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                    <path d="M2 11a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2zM7 7a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7zM12 3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V3z" />
                  </svg>
                  Why?
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main funnel stage block ──────────────────────────────────────────────────
function FunnelStage({
  label, count, metaLabel, metaValue, href, bg, border, accent, countColor, widthClass,
}: {
  label:       string
  count:       number
  metaLabel?:  string
  metaValue?:  string
  href:        string
  bg:          string
  border:      string
  accent:      string
  countColor:  string
  widthClass:  string
}) {
  return (
    <Link
      href={href}
      className={`mx-auto block ${widthClass} rounded-xl border ${border} ${bg} px-4 py-3 transition-opacity hover:opacity-75`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${accent}`}>{label}</p>
          <p className={`mt-0.5 text-2xl font-bold tabular-nums ${countColor}`}>{count}</p>
        </div>
        {metaLabel && metaValue && (
          <div className="text-right">
            <p className="text-[10px] text-zinc-400">{metaLabel}</p>
            <p className="text-base font-semibold text-zinc-600">{metaValue}</p>
          </div>
        )}
      </div>
    </Link>
  )
}

// ─── Roles heading (no box) ───────────────────────────────────────────────────
function RolesHeading({ count, href }: { count: number; href: string }) {
  return (
    <Link
      href={href}
      className="mx-auto flex w-full justify-center px-1 py-1.5 transition-opacity hover:opacity-75"
    >
      <span className="text-lg font-bold tabular-nums text-zinc-700">
        {count}{' '}
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Roles</span>
      </span>
    </Link>
  )
}

// ─── Reasons modal ────────────────────────────────────────────────────────────
function ReasonsModal({
  reasonCounts,
  onClose,
}: {
  reasonCounts: Record<string, number>
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <NotInterestedReasons reasonCounts={reasonCounts} />
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-lg border border-zinc-200 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-50"
        >
          Close
        </button>
      </div>
    </div>
  )
}

// ─── Funnel ───────────────────────────────────────────────────────────────────
export default function PlacementFunnel({
  totalRoles,
  notInterested,
  totalApps,
  notShortlisted,
  stillApplied,
  shortlistPassed,
  inProcess,
  hired,
  rejected,
  reasonCounts,
}: Props) {
  const [showReasons, setShowReasons] = useState(false)

  return (
    <div className="mx-auto max-w-sm">

      {showReasons && (
        <ReasonsModal reasonCounts={reasonCounts} onClose={() => setShowReasons(false)} />
      )}

      {/* ── INTEREST STAGE ── */}
      <SectionLabel label="Interest Stage" />

      <RolesHeading count={totalRoles} href="/placements/companies" />

      <ArrowWithBranches branches={[{
        label:       'Not Interested',
        count:       notInterested,
        href:        '/placements/matching',
        cardBg:      'bg-zinc-50',  cardBorder: 'border-zinc-200',
        labelCls:    'text-zinc-400', countCls: 'text-zinc-700',
        metaCls:     'text-zinc-400', dividerCls: 'bg-zinc-200',
        onWhyClick:  () => setShowReasons(true),
      }]} />

      <FunnelStage
        label="Applications"
        count={totalApps}
        href="/placements/applications"
        bg="bg-blue-50" border="border-blue-100"
        accent="text-blue-500" countColor="text-blue-900"
        widthClass="w-full"
      />

      {/* ── SHORTLISTING STAGE ── */}
      <SectionLabel label="Shortlisting Stage" />

      <ArrowWithBranches branches={[
        {
          label:      'Not Shortlisted',
          count:      notShortlisted,
          pctStr:     `${pct(notShortlisted, totalApps)} of apps`,
          href:       '/placements/applications?status=not_shortlisted',
          cardBg:     'bg-zinc-50',  cardBorder: 'border-zinc-200',
          labelCls:   'text-zinc-400', countCls: 'text-zinc-700',
          metaCls:    'text-zinc-400', dividerCls: 'bg-zinc-200',
        },
        {
          label:      'Still Applied',
          count:      stillApplied,
          pctStr:     `${pct(stillApplied, totalApps)} of apps`,
          href:       '/placements/applications?status=applied',
          cardBg:     'bg-blue-50',  cardBorder: 'border-blue-100',
          labelCls:   'text-blue-400', countCls: 'text-blue-700',
          metaCls:    'text-blue-400', dividerCls: 'bg-blue-200',
        },
      ]} />

      <FunnelStage
        label="Shortlisted"
        count={shortlistPassed}
        metaLabel="shortlist rate"
        metaValue={pct(shortlistPassed, totalApps)}
        href="/placements/applications?status=shortlisted"
        bg="bg-amber-50" border="border-amber-100"
        accent="text-amber-500" countColor="text-amber-900"
        widthClass="w-[85%]"
      />

      {/* ── INTERVIEW CLEARANCE STAGE ── */}
      <SectionLabel label="Interview Clearance Stage" />

      <ArrowWithBranches branches={[
        {
          label:      'In Process',
          count:      inProcess,
          pctStr:     `${pct(inProcess, shortlistPassed)} of shortlisted`,
          href:       '/placements/applications?status=in_process',
          cardBg:     'bg-amber-50', cardBorder: 'border-amber-100',
          labelCls:   'text-amber-500', countCls: 'text-amber-800',
          metaCls:    'text-amber-500', dividerCls: 'bg-amber-200',
        },
        {
          label:      'Rejected',
          count:      rejected,
          pctStr:     `${pct(rejected, shortlistPassed)} of shortlisted`,
          href:       '/placements/applications?status=rejected',
          cardBg:     'bg-red-50',   cardBorder: 'border-red-100',
          labelCls:   'text-red-400', countCls: 'text-red-700',
          metaCls:    'text-red-400', dividerCls: 'bg-red-200',
        },
      ]} />

      <FunnelStage
        label="Hired"
        count={hired}
        metaLabel="hire rate"
        metaValue={pct(hired, shortlistPassed)}
        href="/placements/applications?status=hired"
        bg="bg-emerald-50" border="border-emerald-100"
        accent="text-emerald-500" countColor="text-emerald-900"
        widthClass="w-[65%]"
      />

    </div>
  )
}
