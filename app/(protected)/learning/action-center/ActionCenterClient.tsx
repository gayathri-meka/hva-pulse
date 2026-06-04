'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import MultiSelect from '@/components/filters/MultiSelect'
import DatePicker from '@/components/filters/DatePicker'
import ColumnFilter, { Th, ThLabel } from '@/components/filters/ColumnFilter'

export type ActionLearner = {
  id:     string
  email:  string
  name:   string
  batch:  string
  lfName: string | null
}

export type ActionCall = {
  meeting_code: string
  name:         string
  type:         string
  batch:        string | null
}

export type ActionCenterData = {
  date:           string                       // YYYY-MM-DD IST
  dateLabel:      string                       // "Tuesday, 4 Jun 2026"
  firstName:      string | null                // greeting fallback to "today" if null
  learners:       ActionLearner[]
  callsToday:     ActionCall[]
  presenceByCall: Record<string, string[]>     // meeting_code -> attendee emails
  lfList:         string[]
  initialLf:      string                       // '' = All
}

export default function ActionCenterClient({ data }: { data: ActionCenterData }) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // Default to ALL options selected — visually "All" instead of "None", which
  // matches what the user expects on first load. If the signed-in user is an
  // LF, default the LF filter to just them.
  const [lfFilter, setLfFilter] = useState<Set<string>>(() =>
    data.initialLf ? new Set([data.initialLf]) : new Set(data.lfList),
  )
  const [batchFilter, setBatchFilter] = useState<Set<string>>(() =>
    new Set(data.learners.map((l) => l.batch)),
  )

  function handleDateChange(iso: string) {
    if (!iso) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', iso)
    router.push(`/learning/action-center?${params.toString()}`)
  }

  // Distinct batch options derived from the (full) learner roster.
  const batchOptions = useMemo(
    () => Array.from(new Set(data.learners.map((l) => l.batch))).sort(),
    [data.learners],
  )

  // Learners in scope (LF + Batch filters). "All" (every option selected) is
  // treated identically to "None" — both mean "no filter applied". Otherwise
  // "All" would silently exclude learners whose LF isn't in the registry.
  const inScope = useMemo(() => {
    const lfActive    = lfFilter.size    > 0 && lfFilter.size    < data.lfList.length
    const batchActive = batchFilter.size > 0 && batchFilter.size < batchOptions.length
    return data.learners.filter((l) => {
      if (lfActive    && (!l.lfName || !lfFilter.has(l.lfName))) return false
      if (batchActive && !batchFilter.has(l.batch))              return false
      return true
    })
  }, [data.learners, lfFilter, batchFilter, data.lfList.length, batchOptions.length])

  type NoShow = { learner: ActionLearner; missed: ActionCall[] }

  const noShows: NoShow[] = useMemo(() => {
    const presentSet: Record<string, Set<string>> = {}
    for (const [code, emails] of Object.entries(data.presenceByCall)) {
      presentSet[code] = new Set(emails)
    }

    const out: NoShow[] = []
    for (const learner of inScope) {
      const missed: ActionCall[] = []
      for (const call of data.callsToday) {
        const expected = call.batch === 'All' || call.batch === learner.batch
        if (!expected) continue
        const attended = presentSet[call.meeting_code]?.has(learner.email) ?? false
        if (!attended) missed.push(call)
      }
      if (missed.length > 0) out.push({ learner, missed })
    }

    out.sort((a, b) => {
      if (b.missed.length !== a.missed.length) return b.missed.length - a.missed.length
      return a.learner.name.localeCompare(b.learner.name)
    })
    return out
  }, [inScope, data.callsToday, data.presenceByCall])

  // Names of the calls that ran in scope (after batch filter). For the header
  // "X calls: Standup, Reflection, …".
  const callsForLabel = useMemo(() => {
    if (batchFilter.size === 0) return data.callsToday
    return data.callsToday.filter(
      (c) => c.batch === 'All' || (c.batch && batchFilter.has(c.batch)),
    )
  }, [data.callsToday, batchFilter])

  // Per-column table filters (in addition to the top-level Batch/LF pills).
  const [nameQuery,        setNameQuery]        = useState('')
  const [colBatchFilter,   setColBatchFilter]   = useState<Set<string>>(new Set())
  const [colLfFilter,      setColLfFilter]      = useState<Set<string>>(new Set())
  const [colCallFilter,    setColCallFilter]    = useState<Set<string>>(new Set())

  const filteredNoShows = useMemo(() => {
    const q = nameQuery.trim().toLowerCase()
    return noShows.filter(({ learner, missed }) => {
      if (q) {
        const matchesName = learner.name.toLowerCase().includes(q) || learner.email.toLowerCase().includes(q)
        if (!matchesName) return false
      }
      if (colBatchFilter.size > 0 && !colBatchFilter.has(learner.batch)) return false
      if (colLfFilter.size > 0 && (!learner.lfName || !colLfFilter.has(learner.lfName))) return false
      if (colCallFilter.size > 0 && !missed.some((c) => colCallFilter.has(c.meeting_code))) return false
      return true
    })
  }, [noShows, nameQuery, colBatchFilter, colLfFilter, colCallFilter])

  // Options for the per-column filters — derived from what's actually in the
  // unfiltered no-shows list (so we don't offer batches/LFs that wouldn't
  // match anything).
  const colBatchOptions = useMemo(
    () => Array.from(new Set(noShows.map((n) => n.learner.batch))).sort(),
    [noShows],
  )
  const colLfOptions = useMemo(
    () => Array.from(new Set(noShows.map((n) => n.learner.lfName).filter((v): v is string => !!v))).sort(),
    [noShows],
  )
  const colCallOptions = useMemo(() => {
    const seen = new Map<string, string>()  // code -> display name
    for (const n of noShows) {
      for (const c of n.missed) seen.set(c.meeting_code, c.name)
    }
    return Array.from(seen.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [noShows])

  return (
    <div>
      {/* Greeting */}
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl">
          {data.firstName ? `Hi ${data.firstName}, here's your focus for today!` : `Here's your focus for today!`}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{data.dateLabel} · IST</p>
      </div>

      {/* Filter row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <DatePicker value={data.date} onChange={handleDateChange} />
        <MultiSelect
          label="LF"
          options={data.lfList.map((lf) => ({ value: lf, label: lf }))}
          selected={lfFilter}
          onChange={setLfFilter}
        />
        <MultiSelect
          label="Batch"
          options={batchOptions.map((b) => ({ value: b, label: b }))}
          selected={batchFilter}
          onChange={setBatchFilter}
        />
        <span className="ml-auto text-xs text-zinc-500">
          {inScope.length} learner{inScope.length !== 1 ? 's' : ''} in scope
        </span>
      </div>

      {/* Stat boxes */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatBox
          label="Missed a call"
          count={noShows.length}
          tone={noShows.length > 0 ? 'rose' : 'emerald'}
          onClick={() => document.getElementById('missed-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        />
        <StatBox label="Task outliers"        count={null} tone="zinc" disabledHint="coming soon" />
        <StatBox label="Approaching deadlines" count={null} tone="zinc" disabledHint="coming soon" />
      </div>

      {/* Section 1 — No-shows */}
      <section id="missed-section" className="scroll-mt-4 rounded-xl border border-zinc-200 bg-white">
        <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-zinc-900">Didn&apos;t attend calls</h2>
            {callsForLabel.length === 0 ? (
              <p className="mt-0.5 text-xs text-zinc-500">
                No call attendance recorded for this date{batchFilter.size > 0 ? ' in the selected batches' : ''}.
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-zinc-500">
                {callsForLabel.length} call{callsForLabel.length !== 1 ? 's' : ''}: {formatCallList(callsForLabel)}
              </p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            noShows.length === 0
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}>
            {noShows.length} {noShows.length === 1 ? 'learner' : 'learners'}
          </span>
        </header>

        {noShows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-zinc-400">
            {data.callsToday.length === 0
              ? 'Once attendance is synced for this date, no-shows will appear here.'
              : '🎉 Nobody missed a call in your scope.'}
          </p>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 480px)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left">
                  <Th>
                    <ThLabel>Learner</ThLabel>
                    <input
                      type="text"
                      value={nameQuery}
                      onChange={(e) => setNameQuery(e.target.value)}
                      placeholder="Search…"
                      className="w-full rounded border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-normal normal-case tracking-normal text-zinc-900 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
                    />
                  </Th>
                  <Th>
                    <ThLabel>Batch</ThLabel>
                    <ColumnFilter
                      options={colBatchOptions.map((b) => ({ value: b, label: b }))}
                      selected={colBatchFilter}
                      onChange={setColBatchFilter}
                    />
                  </Th>
                  <Th>
                    <ThLabel>LF</ThLabel>
                    <ColumnFilter
                      options={colLfOptions.map((lf) => ({ value: lf, label: lf }))}
                      selected={colLfFilter}
                      onChange={setColLfFilter}
                    />
                  </Th>
                  <Th>
                    <ThLabel>Calls missed</ThLabel>
                    <ColumnFilter
                      options={colCallOptions}
                      selected={colCallFilter}
                      onChange={setColCallFilter}
                    />
                  </Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredNoShows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-16 text-center text-sm text-zinc-400">
                      No rows match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredNoShows.map(({ learner, missed }) => {
                    const initials = learner.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
                    return (
                      <tr key={learner.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                              {initials}
                            </span>
                            <div>
                              <div className="font-medium text-zinc-900">{learner.name}</div>
                              <div className="text-xs text-zinc-500">{learner.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-600">{learner.batch}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">{learner.lfName ?? '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {missed.map((c) => (
                              <span
                                key={c.meeting_code}
                                title={c.type}
                                className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                              >
                                {c.name}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function StatBox({
  label,
  count,
  tone,
  onClick,
  disabledHint,
}: {
  label:         string
  count:         number | null
  tone:          'rose' | 'emerald' | 'amber' | 'zinc'
  onClick?:      () => void
  disabledHint?: string
}) {
  const disabled = count === null
  // Active tones: clear background tint + matching border. Disabled: muted.
  const toneClass = (() => {
    if (disabled) return 'border-zinc-200 bg-zinc-50/80'
    if (tone === 'rose')    return 'border-rose-200    bg-rose-50    hover:bg-rose-100/70    hover:border-rose-300'
    if (tone === 'emerald') return 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70 hover:border-emerald-300'
    if (tone === 'amber')   return 'border-amber-200   bg-amber-50   hover:bg-amber-100/70   hover:border-amber-300'
    return 'border-zinc-200 bg-zinc-50'
  })()
  const labelColor = disabled ? 'text-zinc-400' : 'text-zinc-700'
  const numColor = (() => {
    if (disabled) return 'text-zinc-300'
    if (tone === 'rose')    return 'text-rose-700'
    if (tone === 'emerald') return 'text-emerald-700'
    if (tone === 'amber')   return 'text-amber-700'
    return 'text-zinc-700'
  })()
  const Tag = onClick && !disabled ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick && !disabled ? onClick : undefined}
      className={`flex flex-col items-start justify-between gap-3 rounded-xl border p-5 text-left transition-colors ${toneClass}`}
    >
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
      {disabled ? (
        <span className="text-xs italic text-zinc-400">{disabledHint ?? '—'}</span>
      ) : (
        <span className={`text-4xl font-bold tabular-nums ${numColor}`}>{count}</span>
      )}
    </Tag>
  )
}

function formatCallList(calls: ActionCall[]): string {
  // Middle-dot separator with spaces reads better than commas when call names
  // contain their own punctuation (e.g. "Mentor Support Call (BE2)").
  return calls.map((c) => c.name).join('  ·  ')
}
