'use client'

import { useMemo, useState } from 'react'
import { buildProspectIndex, matchSignup } from '@/lib/signupMatch'
import type { AnalyticsRow } from './page'

const norm = (e: string | null) => (e ?? '').trim().toLowerCase()

type Preset = 'all' | '30d' | '90d' | 'year' | 'custom'

/** ISO YYYY-MM-DD `days` ago (or null for an open bound). */
function daysAgoISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function startOfYearISO(): string {
  return `${new Date().getFullYear()}-01-01`
}

export default function AnalyticsClient({
  hits,
  signups,
}: {
  hits:    AnalyticsRow[]
  signups: AnalyticsRow[]
}) {
  const [preset, setPreset] = useState<Preset>('all')
  const [from, setFrom]     = useState('')   // '' = open lower bound
  const [to, setTo]         = useState('')   // '' = open upper bound

  function applyPreset(p: Exclude<Preset, 'custom'>) {
    setPreset(p)
    if (p === 'all')  { setFrom('');               setTo('') }
    if (p === '30d')  { setFrom(daysAgoISO(30));   setTo('') }
    if (p === '90d')  { setFrom(daysAgoISO(90));   setTo('') }
    if (p === 'year') { setFrom(startOfYearISO()); setTo('') }
  }

  const inRange = (createdAt: string) => {
    const d = createdAt.slice(0, 10)
    if (from && d < from) return false
    if (to && d > to)     return false
    return true
  }

  const stats = useMemo(() => {
    // Match against the full prospect set regardless of when they signed up —
    // the date range scopes *which website hits* we look at, not when the
    // matching signup happened. Token-first, email-fallback (lib/signupMatch).
    const index = buildProspectIndex(signups)

    const hitsInRange   = hits.filter((h) => inRange(h.created_at))
    const uniqueEmails  = new Set(hitsInRange.map((h) => norm(h.email)).filter(Boolean))

    // Count distinct website-form people who signed up. Key by the matched
    // prospect email when known (token match), else the form email — so a
    // different-email signup still collapses to one person per form submission.
    const signedKeys = new Set<string>()
    for (const h of hitsInRange) {
      const m = matchSignup(h, index)
      if (m.matched) signedKeys.add(m.prospectEmail || norm(h.email) || h.created_at)
    }
    const signedUp       = signedKeys.size
    const signupsInRange = signups.filter((s) => inRange(s.created_at)).length

    return {
      totalHits:    hitsInRange.length,
      uniqueHits:   uniqueEmails.size,
      signedUp,
      totalSignups: signupsInRange,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, signups, from, to])

  const convPct =
    stats.uniqueHits > 0 ? Math.round((stats.signedUp / stats.uniqueHits) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
          <PresetPill label="All time"     active={preset === 'all'}  onClick={() => applyPreset('all')} />
          <PresetPill label="Last 30 days" active={preset === '30d'}  onClick={() => applyPreset('30d')} />
          <PresetPill label="Last 90 days" active={preset === '90d'}  onClick={() => applyPreset('90d')} />
          <PresetPill label="This year"    active={preset === 'year'} onClick={() => applyPreset('year')} />
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500">
          <DateInput
            value={from}
            onChange={(v) => { setFrom(v); setPreset('custom') }}
            ariaLabel="From date"
          />
          <span className="text-zinc-400">→</span>
          <DateInput
            value={to}
            onChange={(v) => { setTo(v); setPreset('custom') }}
            ariaLabel="To date"
          />
        </div>
      </div>

      {/* Website funnel */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Website funnel</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total website hits"
            value={stats.totalHits}
            sublabel="form submissions"
          />
          <StatCard
            label="Unique website hits"
            value={stats.uniqueHits}
            sublabel="by email"
          />
          <StatCard
            label="Signed up to Pulse"
            value={stats.signedUp}
            sublabel={`${convPct}% of unique`}
          />
        </div>
      </section>

      {/* Pulse signups */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Pulse signups</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Total signups"
            value={stats.totalSignups}
            sublabel="prospects"
          />
        </div>
      </section>
    </div>
  )
}

function StatCard({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-zinc-400">{sublabel}</p>
    </div>
  )
}

function PresetPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
        active ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
      }`}
    >
      {label}
    </button>
  )
}

function DateInput({
  value,
  onChange,
  ariaLabel,
}: {
  value:     string
  onChange:  (v: string) => void
  ariaLabel: string
}) {
  return (
    <input
      type="date"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-700 focus:border-[#5BAE5B] focus:outline-none"
    />
  )
}
