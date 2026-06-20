'use client'

import { useMemo, useState } from 'react'
import { buildProspectIndex, matchSignup } from '@/lib/signupMatch'
import { canonicalReferral, canonicalEducation } from '@/lib/marketingFields'
import type { ChallengeFunnel, ChallengeEventDates } from '@/lib/challengeFunnel'
import type { AnalyticsRow } from './page'

const norm = (e: string | null) => (e ?? '').trim().toLowerCase()
// First non-empty value wins — treats null and '' as missing.
const firstFilled = (...vals: (string | null | undefined)[]) =>
  vals.find((v) => v != null && v !== '') ?? null

// Monday-of-week (UTC) for an ISO timestamp.
function weekKey(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

// Categorical distribution: count canonical label values, blanks rolled into
// "Not specified". Sorted by count desc, with "Not specified" pinned last.
type Slice = { label: string; value: number }
const NOT_SPECIFIED = 'Not specified'
function countLabels(values: (string | null)[]): Slice[] {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = (v ?? '').trim() || NOT_SPECIFIED
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => {
      if (a.label === NOT_SPECIFIED) return 1
      if (b.label === NOT_SPECIFIED) return -1
      return b.value - a.value
    })
}

// Count events per week, gap-filled from the first event week through this week
// so empty weeks render as zero bars.
function weeklySeries(dates: string[]): { week: string; value: number }[] {
  if (!dates.length) return []
  const counts = new Map<string, number>()
  for (const iso of dates) {
    const k = weekKey(iso)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const weeks = [...counts.keys()].sort()
  const start = new Date(weeks[0] + 'T00:00:00Z')
  const end = new Date(weekKey(new Date().toISOString()) + 'T00:00:00Z')
  const out: { week: string; value: number }[] = []
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
    const k = d.toISOString().slice(0, 10)
    out.push({ week: k, value: counts.get(k) ?? 0 })
  }
  return out
}

export default function AnalyticsClient({
  hits,
  signups,
  challenge,
  challengeDates,
}: {
  hits:           AnalyticsRow[]
  signups:        AnalyticsRow[]
  challenge:      ChallengeFunnel
  challengeDates: ChallengeEventDates
}) {
  const m = useMemo(() => {
    const index = buildProspectIndex(signups)

    // First-occurrence row per unique website email (for the "unique" series and
    // the unique-hits distributions).
    const firstSeen = new Map<string, AnalyticsRow>()
    for (const h of [...hits].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      const e = norm(h.email)
      if (e && !firstSeen.has(e)) firstSeen.set(e, h)
    }
    const uniqueHitRows = [...firstSeen.values()]

    // Index prospects by email so a website hit can borrow its matched prospect's
    // referral/education when the website form left them blank (same backfill the
    // Website Hits table does).
    const prospectByEmail = new Map<string, AnalyticsRow>()
    for (const s of signups) {
      const e = norm(s.email)
      if (e) prospectByEmail.set(e, s)
    }
    const prospectFor = (h: AnalyticsRow) => {
      const match = matchSignup(h, index)
      const e = match.matched ? match.prospectEmail || norm(h.email) : null
      return e ? prospectByEmail.get(e) : undefined
    }

    // Which website applicants converted (token-first, email-fallback).
    const convertedEmails = new Set<string>()
    for (const h of hits) {
      const match = matchSignup(h, index)
      if (match.matched) convertedEmails.add(match.prospectEmail || norm(h.email))
    }
    const convDates = signups.filter((s) => convertedEmails.has(norm(s.email))).map((s) => s.created_at)

    return {
      totalHits:     hits.length,
      uniqueHits:    firstSeen.size,
      signedUp:      convertedEmails.size,
      totalSignups:  signups.length,
      hitsWeekly:    weeklySeries(hits.map((h) => h.created_at)),
      uniqueWeekly:  weeklySeries(uniqueHitRows.map((r) => r.created_at)),
      signedUpWeekly: weeklySeries(convDates),
      signupsWeekly: weeklySeries(signups.map((s) => s.created_at)),
      // Categorical distributions. Website hits are backfilled from the matched
      // prospect, then both populations are canonicalized to the same labels.
      referralHits: countLabels(
        uniqueHitRows.map((h) => canonicalReferral(firstFilled(h.referral_source, prospectFor(h)?.referral_source))),
      ),
      referralSignups: countLabels(signups.map((s) => canonicalReferral(s.referral_source))),
      eduHits: countLabels(
        uniqueHitRows.map((h) => canonicalEducation(firstFilled(h.educational_status, prospectFor(h)?.educational_status))),
      ),
      eduSignups: countLabels(signups.map((s) => canonicalEducation(s.educational_status))),
    }
  }, [hits, signups])

  const convPct = m.uniqueHits > 0 ? Math.round((m.signedUp / m.uniqueHits) * 100) : 0

  // Weekly trends for the challenge funnel. `joined` stays empty until the BQ view
  // exposing joined_at is re-applied + re-synced (see migrations/bq/004).
  const challengeWeekly = useMemo(
    () => ({
      joined:    weeklySeries(challengeDates.joined),
      started:   weeklySeries(challengeDates.started),
      completed: weeklySeries(challengeDates.completed),
    }),
    [challengeDates],
  )

  return (
    <div className="space-y-6">
      {/* Website funnel */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Website funnel</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Total website hits" value={m.totalHits} sublabel="form submissions" series={m.hitsWeekly} unit="hits" />
          <StatCard label="Unique website hits" value={m.uniqueHits} sublabel="by email" series={m.uniqueWeekly} unit="new unique" />
          <StatCard label="Signed up to Pulse" value={m.signedUp} sublabel={`${convPct}% of unique`} series={m.signedUpWeekly} unit="signups" />
        </div>
      </section>

      {/* Pulse signups + 14-day challenge — one row of four boxes */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Pulse signups &amp; 14-day challenge <span className="font-normal normal-case tracking-normal text-zinc-300">· current</span>
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pulse signups" value={m.totalSignups} sublabel="prospects" series={m.signupsWeekly} unit="signups" />
          <StatCard
            label="Joined SensAI"
            value={challenge.joined}
            sublabel="in the screening cohort"
            series={challengeWeekly.joined}
            unit="joined"
          />
          <StatCard
            label="Started"
            value={challenge.started}
            sublabel={`${challenge.joined > 0 ? Math.round((challenge.started / challenge.joined) * 100) : 0}% of joined`}
            series={challengeWeekly.started}
            unit="started"
          />
          <StatCard
            label="Completed"
            value={challenge.completed}
            sublabel={`${challenge.joined > 0 ? Math.round((challenge.completed / challenge.joined) * 100) : 0}% of joined`}
            series={challengeWeekly.completed}
            unit="completed"
          />
        </div>
      </section>

      {/* Audience breakdown — collapsible categorical distributions */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Audience breakdown</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DistributionCard
            label="Referral source"
            datasets={[
              { key: 'hits', label: 'Website hits', noun: 'unique website hits', data: m.referralHits },
              { key: 'prospects', label: 'Prospects', noun: 'prospects', data: m.referralSignups },
            ]}
          />
          <DistributionCard
            label="Educational status"
            datasets={[
              { key: 'hits', label: 'Website hits', noun: 'unique website hits', data: m.eduHits },
              { key: 'prospects', label: 'Prospects', noun: 'prospects', data: m.eduSignups },
            ]}
          />
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  sublabel,
  series,
  unit = 'per week',
}: {
  label: string
  value: number
  sublabel: string
  series?: { week: string; value: number }[]
  unit?: string
}) {
  const [showChart, setShowChart] = useState(false)
  const hasChart = !!series && series.length > 0

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
        {hasChart && (
          <button
            onClick={() => setShowChart((s) => !s)}
            title="Weekly trend"
            className={`rounded-md p-1 transition-colors ${
              showChart ? 'bg-zinc-100 text-zinc-700' : 'text-zinc-300 hover:bg-zinc-50 hover:text-zinc-500'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 8A1.5 1.5 0 0 0 8 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 9.5 8ZM3.5 12A1.5 1.5 0 0 0 2 13.5v3a1.5 1.5 0 0 0 3 0v-3A1.5 1.5 0 0 0 3.5 12Z" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{sublabel}</p>
      {hasChart && showChart && <WeeklyChart series={series!} unit={unit} />}
    </div>
  )
}

// Categorical distribution card: a per-population toggle over horizontal bars.
function DistributionCard({
  label,
  datasets,
}: {
  label: string
  datasets: { key: string; label: string; noun: string; data: Slice[] }[]
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ds = datasets[active]
  const total = ds.data.reduce((s, d) => s + d.value, 0)
  const max = Math.max(1, ...ds.data.map((d) => d.value))
  // Collapsed summary: just the most common category.
  const topSlice = ds.data.find((d) => d.label !== NOT_SPECIFIED) ?? ds.data[0]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
        <span className="flex items-center gap-2 text-xs text-zinc-400">
          {!open && topSlice && (
            <span className="hidden truncate sm:inline">top: {topSlice.label}</span>
          )}
          <svg
            className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-zinc-400">{total.toLocaleString()} {ds.noun}</p>
            <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-xs font-medium">
              {datasets.map((d, i) => (
                <button
                  key={d.key}
                  onClick={() => setActive(i)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${
                    active === i ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          {ds.data.length === 0 ? (
            <p className="py-6 text-center text-xs text-zinc-300">No data yet.</p>
          ) : (
            <div className="space-y-2.5">
              {ds.data.map((d) => {
                const muted = d.label === NOT_SPECIFIED
                return (
                  <div key={d.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className={`truncate text-xs ${muted ? 'text-zinc-400' : 'text-zinc-600'}`} title={d.label}>
                        {d.label}
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-700">
                        {d.value}
                        <span className="ml-1 font-normal text-zinc-400">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(d.value / max) * 100}%`, backgroundColor: muted ? '#d4d4d8' : '#5BAE5B' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Round up to a clean axis maximum (1/2/5 × 10ⁿ).
function niceMax(v: number): number {
  if (v <= 5) return Math.max(1, v)
  const pow = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / pow
  const nice = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 5 ? 5 : 10
  return nice * pow
}

// Weekly bar chart (last ~16 weeks) with real X (week) and Y (count) axes
// and an interactive per-week value readout (hover / tap).
function WeeklyChart({ series, unit }: { series: { week: string; value: number }[]; unit: string }) {
  const [active, setActive] = useState<number | null>(null)
  const data = series.slice(-16)
  const n = data.length
  const top = niceMax(Math.max(...data.map((d) => d.value)))

  // viewBox geometry
  const W = 360, H = 152
  const padL = 26, padR = 8, padT = 16, padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const bw = plotW / n
  const baseY = padT + plotH
  const yOf = (v: number) => baseY - (v / top) * plotH
  const fmt = (w: string) =>
    new Date(w + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })

  const yTicks = [0, top / 2, top].filter((v, i, a) => a.indexOf(v) === i)
  const labelEvery = Math.max(1, Math.ceil(n / 6))
  const cur = active != null ? data[active] : null

  return (
    <div className="mt-3 border-t border-zinc-100 pt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly trend">
        {/* Y gridlines + labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={yOf(t)} x2={W - padR} y2={yOf(t)} stroke="#f1f1f3" strokeWidth={1} />
            <text x={padL - 4} y={yOf(t) + 3} textAnchor="end" className="fill-zinc-400" style={{ fontSize: 8 }}>
              {Math.round(t)}
            </text>
          </g>
        ))}

        {/* Bars (each wrapped with a full-height transparent hit area) */}
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(1.5, (d.value / top) * plotH) : 0
          const x = padL + i * bw
          const isActive = active === i
          return (
            <g
              key={d.week}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((a) => (a === i ? null : a))}
              onClick={() => setActive((a) => (a === i ? null : i))}
              style={{ cursor: 'pointer' }}
            >
              <rect x={x} y={padT} width={bw} height={plotH} fill="transparent" />
              <rect
                x={x + bw * 0.15}
                y={baseY - h}
                width={bw * 0.7}
                height={h}
                rx={1}
                fill={isActive ? '#166534' : '#5BAE5B'}
              />
              {isActive && (
                <text x={x + bw / 2} y={baseY - h - 3} textAnchor="middle" className="fill-zinc-900" style={{ fontSize: 9, fontWeight: 700 }}>
                  {d.value}
                </text>
              )}
            </g>
          )
        })}

        {/* X axis line */}
        <line x1={padL} y1={baseY} x2={W - padR} y2={baseY} stroke="#e4e4e7" strokeWidth={1} />

        {/* X labels (active week always labelled + emphasised) */}
        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 || active === i ? (
            <text
              key={d.week}
              x={padL + i * bw + bw / 2}
              y={H - 8}
              textAnchor="middle"
              className={active === i ? 'fill-zinc-700' : 'fill-zinc-400'}
              style={{ fontSize: 8, fontWeight: active === i ? 700 : 400 }}
            >
              {fmt(d.week)}
            </text>
          ) : null,
        )}
      </svg>
      <p className="mt-1 text-center text-[10px] text-zinc-500">
        {cur ? (
          <>
            <span className="font-semibold text-[#166534]">{cur.value}</span> {unit} · week of {fmt(cur.week)}
          </>
        ) : (
          <span className="text-zinc-400">{unit} per week · hover a bar for its value</span>
        )}
      </p>
    </div>
  )
}
