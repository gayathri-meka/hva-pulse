'use client'

import Link from 'next/link'

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
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-zinc-200" />
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  )
}

// ─── Simple downward arrow (fixed height, between same-width stages) ──────────
function Arrow() {
  return (
    <div className="flex justify-center py-0.5 text-zinc-300">
      <svg width="14" height="24" viewBox="0 0 14 24" fill="none">
        <line x1="7" y1="0" x2="7" y2="18" stroke="currentColor" strokeWidth="1.5" />
        <path d="M1 14l6 8 6-8" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ─── Branch card ──────────────────────────────────────────────────────────────
interface BranchCard {
  label:      string
  count:      number
  pctStr?:    string   // omit to hide the meta line
  href:       string
  cardBg:     string
  cardBorder: string
  labelCls:   string
  countCls:   string
  metaCls:    string
  dividerCls: string
}

// ─── Arrow with one or more dropout branches to the right ────────────────────
function ArrowWithBranches({ branches }: { branches: BranchCard[] }) {
  return (
    <div className="flex items-stretch py-1">
      {/* Left spacer — keeps arrow centred */}
      <div className="flex-1" />

      {/* Center: variable-height shaft + arrowhead */}
      <div className="flex flex-col items-center px-8">
        <div className="w-px flex-1 bg-zinc-300" />
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" className="mt-[-1px] shrink-0 text-zinc-300">
          <path d="M1 1l6 7 6-7" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Right: stacked branch cards */}
      <div className="flex flex-1 flex-col justify-center gap-2 py-1">
        {branches.map((b) => (
          <div key={b.label} className="flex items-center gap-3">
            <div className={`h-px w-8 shrink-0 ${b.dividerCls}`} />
            <Link
              href={b.href}
              className={`block rounded-xl border ${b.cardBorder} ${b.cardBg} px-4 py-2.5 transition-opacity hover:opacity-75`}
            >
              <p className={`text-[10px] font-semibold uppercase tracking-widest ${b.labelCls}`}>
                {b.label}
              </p>
              <p className={`mt-0.5 text-xl font-bold tabular-nums ${b.countCls}`}>{b.count}</p>
              {b.pctStr && (
                <p className={`mt-0.5 text-xs ${b.metaCls}`}>{b.pctStr}</p>
              )}
            </Link>
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
      className={`mx-auto block ${widthClass} rounded-xl border ${border} ${bg} px-6 py-4 transition-opacity hover:opacity-75`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-widest ${accent}`}>{label}</p>
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
  notInterested,
  totalApps,
  notShortlisted,
  stillApplied,
  shortlistPassed,
  inProcess,
  hired,
  rejected,
}: Props) {
  return (
    <div className="mx-auto max-w-lg">

      {/* ── INTEREST STAGE ── */}
      <SectionLabel label="Interest Stage" />

      <FunnelStage
        label="Roles"
        count={totalRoles}
        href="/placements/companies"
        bg="bg-zinc-50" border="border-zinc-200"
        accent="text-zinc-500" countColor="text-zinc-900"
        widthClass="w-full"
      />

      <ArrowWithBranches branches={[{
        label:      'Not Interested',
        count:      notInterested,
        href:       '/placements/matching?status=not_interested',
        cardBg:     'bg-zinc-50',  cardBorder: 'border-zinc-200',
        labelCls:   'text-zinc-400', countCls: 'text-zinc-700',
        metaCls:    'text-zinc-400', dividerCls: 'bg-zinc-200',
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
          pctStr:     `${pct(notShortlisted, totalApps)} of applications`,
          href:       '/placements/applications?status=not_shortlisted',
          cardBg:     'bg-zinc-50',  cardBorder: 'border-zinc-200',
          labelCls:   'text-zinc-400', countCls: 'text-zinc-700',
          metaCls:    'text-zinc-400', dividerCls: 'bg-zinc-200',
        },
        {
          label:      'Still Applied',
          count:      stillApplied,
          pctStr:     `${pct(stillApplied, totalApps)} of applications`,
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
        href="/placements/applications"
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
          href:       '/placements/applications?status=shortlisted',
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
