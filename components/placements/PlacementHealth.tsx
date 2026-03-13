import Link from 'next/link'
import ThresholdEditor from './ThresholdEditor'
import type { PlacementThresholds } from '@/app/(protected)/placements/analytics/actions'

export interface HealthData {
  openRoles:         number
  weeklyAvg:         number
  appsPerRole:       number   // raw ratio
  notInterestedRate: number   // 0–1
  shortlistRate:     number   // 0–1
  hireRate:          number   // 0–1
  totalRoles:        number
  totalApps:         number
  thresholds:        PlacementThresholds
  isAdmin:           boolean
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// Each score is 0–1 (higher = healthier). Targets are read from DB settings
// so admins can tune them as the programme scales.
function computeScores(h: HealthData) {
  return {
    demand:     Math.min(h.openRoles / h.thresholds.demand_target, 1),
    engagement: Math.min(h.appsPerRole / h.thresholds.engagement_target, 1),
    conversion: Math.min(h.hireRate / h.thresholds.conversion_target, 1),
  }
}

// ── Dimension config ──────────────────────────────────────────────────────────
const DIMENSIONS = [
  {
    key:         'demand',
    label:       'Demand',
    sublabel:    'Are there enough companies posting roles?',
    dotCls:      'bg-emerald-400',
    labelCls:    'text-emerald-600',
    borderCls:   'border-emerald-100',
    bgCls:       'bg-emerald-50',
    href:        '/placements/companies',
    linkLabel:   'Companies',
  },
  {
    key:         'engagement',
    label:       'Engagement',
    sublabel:    'Are learners applying to enough roles?',
    dotCls:      'bg-blue-400',
    labelCls:    'text-blue-600',
    borderCls:   'border-blue-100',
    bgCls:       'bg-blue-50',
    href:        '/placements/matching',
    linkLabel:   'Matching',
  },
  {
    key:         'conversion',
    label:       'Conversion',
    sublabel:    'Are learners getting shortlisted and hired?',
    dotCls:      'bg-amber-400',
    labelCls:    'text-amber-600',
    borderCls:   'border-amber-100',
    bgCls:       'bg-amber-50',
    href:        '/placements/applications',
    linkLabel:   'Applications',
  },
] as const

// ── Focus area messages ───────────────────────────────────────────────────────
function focusMessage(weakest: string, h: HealthData): { title: string; body: string; href: string } {
  const niPct    = Math.round(h.notInterestedRate * 100)
  const slPct    = Math.round(h.shortlistRate * 100)
  const hirePct  = Math.round(h.hireRate * 100)
  const appsStr  = h.appsPerRole.toFixed(1)
  const weeklyStr = h.weeklyAvg.toFixed(1)

  if (weakest === 'demand') return {
    title: 'Demand',
    href:  '/placements/companies',
    body:  `Only ${h.openRoles} open role${h.openRoles !== 1 ? 's' : ''} right now`
      + (h.weeklyAvg < 3 ? `, with ${weeklyStr} roles added per week on average` : '')
      + '. Consider sourcing more companies to give learners more opportunities to apply.',
  }

  if (weakest === 'engagement') return {
    title: 'Engagement',
    href:  '/placements/matching',
    body:  `${appsStr} applications per role on average`
      + (niPct > 15 ? ` — ${niPct}% of roles are being marked as not interested` : '')
      + '. Learners may need encouragement to engage with more opportunities.',
  }

  return {
    title: 'Conversion',
    href:  '/placements/applications',
    body:  `Only ${slPct}% of applications result in a shortlist`
      + (hirePct < 50 && h.hireRate > 0 ? `, and only ${hirePct}% of completed interview processes end in a hire` : '')
      + '. There may be a gap between learner profiles and what companies are looking for.',
  }
}

// ── Metric rows per dimension ─────────────────────────────────────────────────
function metrics(key: string, h: HealthData): { primary: string; primaryUnit: string; secondary: string }  {
  if (key === 'demand') return {
    primary:     String(h.openRoles),
    primaryUnit: 'active roles',
    secondary:   `${h.weeklyAvg.toFixed(1)} added / week`,
  }
  if (key === 'engagement') return {
    primary:     h.appsPerRole.toFixed(1),
    primaryUnit: 'apps / role',
    secondary:   `${Math.round(h.notInterestedRate * 100)}% not interested`,
  }
  return {
    primary:     `${Math.round(h.hireRate * 100)}%`,
    primaryUnit: 'hired (completed)',
    secondary:   `${Math.round(h.shortlistRate * 100)}% shortlist rate`,
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PlacementHealth(h: HealthData) {
  // Don't render until there's enough data to say something meaningful
  if (h.totalRoles < 3 || h.totalApps < 5) return null

  const scores  = computeScores(h)
  const weakest = (Object.entries(scores).sort((a, b) => a[1] - b[1])[0][0]) as string
  const allWell = Object.values(scores).every((s) => s >= 0.65)
  const focus   = focusMessage(weakest, h)

  return (
    <div className="mb-8 space-y-3">

      {/* ── Section header with benchmark editor ── */}
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Placement Health</p>
        <ThresholdEditor thresholds={h.thresholds} isAdmin={h.isAdmin} />
      </div>

      {/* ── Option A: three diagnostic cards ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DIMENSIONS.map((dim) => {
          const m = metrics(dim.key, h)
          return (
            <Link
              key={dim.key}
              href={dim.href}
              className={`group flex flex-col justify-between rounded-xl border ${dim.borderCls} ${dim.bgCls} p-4 transition-opacity hover:opacity-75`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${dim.dotCls}`} />
                  <span className={`text-[10px] font-semibold uppercase tracking-widest ${dim.labelCls}`}>
                    {dim.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-zinc-400">{dim.sublabel}</p>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold tabular-nums text-zinc-900">{m.primary}</span>
                  <span className="text-xs text-zinc-500">{m.primaryUnit}</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-400">{m.secondary}</p>
              </div>
              <div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-medium text-zinc-400 group-hover:text-zinc-600">
                {dim.linkLabel}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
                  <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── Option B: weakest-link callout ── */}
      {allWell ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-emerald-500">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-emerald-700">
            <span className="font-semibold">All dimensions are on track.</span>
            {' '}Good demand, learner engagement, and conversion rates.
          </p>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3.5">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-zinc-800">
                Focus area: {focus.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-600">{focus.body}</p>
            </div>
          </div>
          <Link
            href={focus.href}
            className="shrink-0 text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            View →
          </Link>
        </div>
      )}

    </div>
  )
}
