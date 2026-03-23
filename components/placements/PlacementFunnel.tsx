'use client'

import { useState } from 'react'
import Link from 'next/link'
import NotInterestedReasons from './NotInterestedReasons'

interface Props {
  totalRoles:                 number
  weeklyRoles:                { label: string; isoDate: string; count: number }[]
  notInterested:              number
  totalApps:                  number
  notShortlisted:             number
  stillApplied:               number
  shortlistPassed:            number
  yetToStart:                 number
  interviewsOngoing:          number
  onHold:                     number
  hired:                      number
  rejected:                   number
  reasonCounts:               Record<string, number>
  notShortlistedReasonCounts: Record<string, number>
  rejectionReasonCounts:      Record<string, number>
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
interface TwinCard {
  label:      string
  count:      number
  pctStr?:    string
  href:       string
  cardBg:     string
  cardBorder: string
  labelCls:   string
  countCls:   string
  metaCls:    string
}

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
  twin?:        TwinCard
}

// ─── Arrow with one or more dropout branches to the right ────────────────────
function ArrowWithBranches({ branches }: { branches: BranchCard[] }) {
  return (
    <div className="flex items-stretch">
      {/* Center: variable-height shaft + arrowhead */}
      <div className="flex w-10 shrink-0 flex-col items-center">
        <div className="w-px flex-1 bg-zinc-300" />
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="mt-[-1px] shrink-0 text-zinc-300">
          <path d="M1 1l6 7 6-7" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Right: stacked branch cards */}
      <div className="flex flex-1 flex-col justify-center gap-1.5 py-0.5">
        {branches.map((b) => (
          <div key={b.label} className="flex items-center gap-1">
            <div className={`h-px w-3 shrink-0 ${b.dividerCls}`} />
            {b.twin ? (
              <div className="flex gap-1.5">
                <Link
                  href={b.href}
                  className={`block rounded-lg border ${b.cardBorder} ${b.cardBg} px-3 py-2 transition-opacity hover:opacity-75`}
                >
                  <p className={`text-[9px] font-semibold uppercase tracking-widest ${b.labelCls}`}>{b.label}</p>
                  <p className={`mt-0.5 text-base font-bold tabular-nums ${b.countCls}`}>{b.count}</p>
                  {b.pctStr && <p className={`text-[10px] ${b.metaCls}`}>{b.pctStr}</p>}
                </Link>
                <Link
                  href={b.twin.href}
                  className={`block rounded-lg border ${b.twin.cardBorder} ${b.twin.cardBg} px-3 py-2 transition-opacity hover:opacity-75`}
                >
                  <p className={`text-[9px] font-semibold uppercase tracking-widest ${b.twin.labelCls}`}>{b.twin.label}</p>
                  <p className={`mt-0.5 text-base font-bold tabular-nums ${b.twin.countCls}`}>{b.twin.count}</p>
                  {b.twin.pctStr && <p className={`text-[10px] ${b.twin.metaCls}`}>{b.twin.pctStr}</p>}
                </Link>
              </div>
            ) : (
              <Link
                href={b.href}
                className={`block rounded-lg border ${b.cardBorder} ${b.cardBg} px-3 py-2 transition-opacity hover:opacity-75`}
              >
                <p className={`text-[9px] font-semibold uppercase tracking-widest ${b.labelCls}`}>{b.label}</p>
                <p className={`mt-0.5 text-base font-bold tabular-nums ${b.countCls}`}>{b.count}</p>
                {b.pctStr && <p className={`text-[10px] ${b.metaCls}`}>{b.pctStr}</p>}
              </Link>
            )}
            {b.onWhyClick && (
              <button
                onClick={b.onWhyClick}
                className="flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-500 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path d="M2 11a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2zM7 7a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7zM12 3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V3z" />
                </svg>
                Why?
              </button>
            )}
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
  href?:       string
  bg:          string
  border:      string
  accent:      string
  countColor:  string
  widthClass:  string
}) {
  const cls = `block ${widthClass} rounded-xl border ${border} ${bg} px-4 py-3`
  const inner = (
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
  )
  if (!href) return <div className={cls}>{inner}</div>
  return <Link href={href} className={`${cls} transition-opacity hover:opacity-75`}>{inner}</Link>
}

// ─── Roles box with "When?" button ───────────────────────────────────────────
function RolesBox({ count, href, onWhenClick }: { count: number; href: string; onWhenClick: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-1">
      <Link href={href} className="flex items-baseline gap-1.5 transition-opacity hover:opacity-75">
        <span className="text-lg font-bold tabular-nums text-zinc-700">{count}</span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Roles</span>
      </Link>
      <button
        onClick={onWhenClick}
        className="flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-500 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
          <path d="M2 11a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2zM7 7a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7zM12 3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1V3z" />
        </svg>
        When?
      </button>
    </div>
  )
}

// ─── Weekly breakdown modal ───────────────────────────────────────────────────
function WeeklyModal({
  weeklyRoles,
  onClose,
}: {
  weeklyRoles: { label: string; isoDate: string; count: number }[]
  onClose: () => void
}) {
  const allCounts = weeklyRoles.map((w) => w.count)
  const maxCount  = Math.max(...allCounts, 1)

  // Stats
  const last4   = weeklyRoles.slice(0, 4)
  const avg4    = last4.length > 0 ? Math.round(last4.reduce((s, w) => s + w.count, 0) / last4.length) : 0
  const highest = allCounts.length > 0 ? Math.max(...allCounts) : 0
  const nonZero = allCounts.filter((c) => c > 0)
  const lowest  = nonZero.length > 0 ? Math.min(...nonZero) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-zinc-900">Role Posting Momentum</p>
        <p className="mt-0.5 text-xs text-zinc-500">Roles added each week (week starts Monday)</p>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-3 divide-x divide-zinc-200 rounded-xl bg-zinc-50 py-3">
          <div className="px-3 text-center">
            <p className="text-lg font-bold tabular-nums text-zinc-900">{avg4}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">Avg / week<br />(last 4)</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-lg font-bold tabular-nums text-emerald-600">{highest}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">Highest<br />week</p>
          </div>
          <div className="px-3 text-center">
            <p className="text-lg font-bold tabular-nums text-zinc-600">{lowest ?? '—'}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">Lowest<br />week</p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="mt-4 max-h-64 overflow-x-auto overflow-y-auto">
          <div className="min-w-[240px] space-y-3">
          {weeklyRoles.length === 0 ? (
            <p className="text-xs text-zinc-400">No data available.</p>
          ) : (
            weeklyRoles.map((w) => (
              <Link
                key={w.label}
                href={`/placements/companies?view=table&week=${w.isoDate}`}
                onClick={onClose}
                className="group flex items-center gap-3 rounded-lg px-1 py-0.5 hover:bg-zinc-50"
                title={`View roles added week of ${w.label}`}
              >
                <span className="w-12 shrink-0 text-right text-xs text-zinc-500 group-hover:text-zinc-700 md:w-16">{w.label}</span>
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className="h-5 rounded bg-[#5BAE5B]/25 transition-colors group-hover:bg-[#5BAE5B]/40"
                    style={{ width: `${(w.count / maxCount) * 100}%`, minWidth: w.count > 0 ? '4px' : '0' }}
                  />
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-700">{w.count}</span>
                </div>
              </Link>
            ))
          )}
          </div>
        </div>
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

// ─── Reasons modal ────────────────────────────────────────────────────────────
function ReasonsModal({
  reasonCounts,
  title,
  subtitle,
  onClose,
}: {
  reasonCounts: Record<string, number>
  title:    string
  subtitle: string
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
        <NotInterestedReasons reasonCounts={reasonCounts} title={title} subtitle={subtitle} />
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
  weeklyRoles,
  notInterested,
  totalApps,
  notShortlisted,
  stillApplied,
  shortlistPassed,
  yetToStart,
  interviewsOngoing,
  onHold,
  hired,
  rejected,
  reasonCounts,
  notShortlistedReasonCounts,
  rejectionReasonCounts,
}: Props) {
  const [showReasons,         setShowReasons]         = useState(false)
  const [showNSReasons,       setShowNSReasons]       = useState(false)
  const [showRejReasons,      setShowRejReasons]      = useState(false)
  const [showWhenModal,       setShowWhenModal]       = useState(false)

  return (
    <div className="mx-auto max-w-sm">

      {showWhenModal && (
        <WeeklyModal weeklyRoles={weeklyRoles} onClose={() => setShowWhenModal(false)} />
      )}
      {showReasons && (
        <ReasonsModal
          reasonCounts={reasonCounts}
          title="Why Learners Decline Roles"
          subtitle="Reasons given when marking a role as not interested"
          onClose={() => setShowReasons(false)}
        />
      )}
      {showNSReasons && (
        <ReasonsModal
          reasonCounts={notShortlistedReasonCounts}
          title="Why Learners Are Not Shortlisted"
          subtitle="Reasons given when moving an application to not shortlisted"
          onClose={() => setShowNSReasons(false)}
        />
      )}
      {showRejReasons && (
        <ReasonsModal
          reasonCounts={rejectionReasonCounts}
          title="Why Learners Are Getting Rejected"
          subtitle="Reasons given when rejecting an application after interview"
          onClose={() => setShowRejReasons(false)}
        />
      )}

      {/* ── INTEREST STAGE ── */}
      <SectionLabel label="Interest Stage" />

      <RolesBox count={totalRoles} href="/placements/companies" onWhenClick={() => setShowWhenModal(true)} />

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
        metaLabel="avg / role"
        metaValue={totalRoles > 0 ? (totalApps / totalRoles).toFixed(1) : '—'}
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
          onWhyClick: () => setShowNSReasons(true),
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
        bg="bg-amber-50" border="border-amber-100"
        accent="text-amber-500" countColor="text-amber-900"
        widthClass="w-[85%]"
      />

      {/* ── INTERVIEW CLEARANCE STAGE ── */}
      <SectionLabel label="Interview Clearance Stage" />

      <ArrowWithBranches branches={[
        {
          label:      'Yet to Start',
          count:      yetToStart,
          pctStr:     `${pct(yetToStart, shortlistPassed)} of shortlisted`,
          href:       '/placements/applications?status=shortlisted',
          cardBg:     'bg-amber-50',  cardBorder: 'border-amber-100',
          labelCls:   'text-amber-500', countCls: 'text-amber-800',
          metaCls:    'text-amber-500', dividerCls: 'bg-amber-200',
          twin: {
            label:      'Interviews Ongoing',
            count:      interviewsOngoing,
            pctStr:     `${pct(interviewsOngoing, shortlistPassed)} of shortlisted`,
            href:       '/placements/applications?status=interviews_ongoing',
            cardBg:     'bg-violet-50',   cardBorder: 'border-violet-100',
            labelCls:   'text-violet-500', countCls: 'text-violet-800',
            metaCls:    'text-violet-500',
          },
        },
        {
          label:      'On Hold',
          count:      onHold,
          pctStr:     `${pct(onHold, shortlistPassed)} of shortlisted`,
          href:       '/placements/applications?status=on_hold',
          cardBg:     'bg-orange-50', cardBorder: 'border-orange-100',
          labelCls:   'text-orange-400', countCls: 'text-orange-700',
          metaCls:    'text-orange-400', dividerCls: 'bg-orange-200',
        },
        {
          label:      'Rejected',
          count:      rejected,
          pctStr:     `${pct(rejected, shortlistPassed)} of shortlisted`,
          href:       '/placements/applications?status=rejected',
          cardBg:     'bg-red-50',   cardBorder: 'border-red-100',
          labelCls:   'text-red-400', countCls: 'text-red-700',
          metaCls:    'text-red-400', dividerCls: 'bg-red-200',
          onWhyClick: () => setShowRejReasons(true),
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
