'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DayPicker } from 'react-day-picker'
import { format as fmt, parse as parseDate } from 'date-fns'

// ── Shared types ────────────────────────────────────────────────────────────

export type LearnerFlat = {
  id:    string
  email: string
  name:  string
  batch: string
}

export type SessionFlat = {
  meeting_code: string
  name:         string
  type:         string
  batch:        string | null
  date:         string
  time:         string | null
}

export type AttendeeFlat = {
  email:            string
  name:             string
  batch:            string | null    // null if attendee isn't in our roster
  learnerId:        string | null
  duration_minutes: number | null
}

export type AttendanceData = {
  batches:            string[]
  learners:           LearnerFlat[]
  sessions:           SessionFlat[]
  presentKeys:        string[]   // "<meeting_code>::<date>::<email>"
  attendeesBySession: Record<string, AttendeeFlat[]>   // key = "<meeting_code>::<date>"
}

type SessionWithStatus = {
  meeting_code: string
  name:         string
  type:         string
  date:         string
  time:         string | null
  status:       'present' | 'absent'
}

// ── Page ────────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { key: 'attendance-asc',  label: 'Attendance ↑' },
  { key: 'attendance-desc', label: 'Attendance ↓' },
  { key: 'name',            label: 'Name A→Z'     },
] as const
type SortKey = (typeof SORT_OPTIONS)[number]['key']

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AttendanceClient({ data }: { data: AttendanceData }) {
  const presentSet = useMemo(() => new Set(data.presentKeys), [data.presentKeys])
  const router = useRouter()
  const [syncing, startSync] = useTransition()
  const [syncMsg, setSyncMsg] = useState<string | null>(null)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [date, setDate] = useState<string>(todayIso())
  const [selectedBatches, setSelectedBatches] = useState<Set<string>>(
    () => new Set(data.batches),
  )

  // Filtered learners (matching selected batches)
  const filteredLearners = useMemo(
    () => data.learners.filter((l) => selectedBatches.has(l.batch)),
    [data.learners, selectedBatches],
  )

  // Calls relevant to selected batches: call.batch ∈ selectedBatches OR call.batch === 'All'
  // We dedupe by meeting_code (one option per call) and label by name.
  const callOptions = useMemo(() => {
    const seen = new Map<string, string>()  // meeting_code -> display name
    for (const s of data.sessions) {
      if (seen.has(s.meeting_code)) continue
      const matchesBatch =
        (s.batch && selectedBatches.has(s.batch)) || s.batch === 'All'
      if (matchesBatch) seen.set(s.meeting_code, s.name)
    }
    // Return array of { code, name } sorted by name
    return Array.from(seen.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [data.sessions, selectedBatches])

  const [selectedCalls, setSelectedCalls] = useState<Set<string>>(new Set())
  // When call options change (because batches changed), re-default to "All"
  const lastOptKeyRef = useRef<string>('')
  useEffect(() => {
    const key = callOptions.map((o) => o.code).sort().join(',')
    if (key !== lastOptKeyRef.current) {
      lastOptKeyRef.current = key
      setSelectedCalls(new Set(callOptions.map((o) => o.code)))
    }
  }, [callOptions])

  // ── Sessions matching all filters ─────────────────────────────────────────
  // For card section: when date === '' we show all dates; otherwise restrict
  // to that specific date. Also matches selected calls, and (batch ∈
  // selectedBatches OR batch === 'All').
  const sessionsForCards = useMemo(() => {
    return data.sessions.filter((s) => {
      if (date !== '' && s.date !== date) return false
      if (!selectedCalls.has(s.meeting_code)) return false
      const matchesBatch =
        (s.batch && selectedBatches.has(s.batch)) || s.batch === 'All'
      return matchesBatch
    })
  }, [data.sessions, date, selectedBatches, selectedCalls])

  // For learner table: all sessions matching the call+batch filter (any date).
  const sessionsForTable = useMemo(() => {
    return data.sessions.filter((s) => {
      if (!selectedCalls.has(s.meeting_code)) return false
      const matchesBatch =
        (s.batch && selectedBatches.has(s.batch)) || s.batch === 'All'
      return matchesBatch
    })
  }, [data.sessions, selectedBatches, selectedCalls])

  // Dates that have at least one session under the current batch+call filters.
  // The date picker uses this to grey out empty dates and to auto-snap when
  // the previously-picked date becomes invalid.
  const validDates = useMemo(
    () => new Set(sessionsForTable.map((s) => s.date)),
    [sessionsForTable],
  )

  // If the current date isn't in validDates (and isn't the "all dates"
  // sentinel), snap to the most recent valid date.
  useEffect(() => {
    if (date === '') return
    if (validDates.size === 0) return
    if (validDates.has(date)) return
    const sorted = Array.from(validDates).sort().reverse()
    setDate(sorted[0])
  }, [validDates, date])

  // ── Card summaries ─────────────────────────────────────────────────────────
  // Attended  = everyone in attendees for this session (no batch filter — if
  //             you showed up, you attended, even external folks).
  // Absent    = expected learners NOT in the attendee email set.
  // "Expected" depends on the call's batch tag:
  //   - batch-specific call (BE1/JS2/...): all Ongoing learners in that batch
  //   - "All"-tagged call:                 Ongoing learners in selected batches
  const callSummaries = useMemo(() => {
    return sessionsForCards.map((s) => {
      const attendees = data.attendeesBySession[`${s.meeting_code}::${s.date}`] ?? []
      const attendedEmails = new Set(attendees.map((a) => a.email))

      const expected: LearnerFlat[] =
        s.batch === 'All'
          ? filteredLearners
          : data.learners.filter((l) => l.batch === s.batch)

      const absent = expected.filter((l) => !attendedEmails.has(l.email))

      return { session: s, attendees, absent }
    })
  }, [sessionsForCards, filteredLearners, data.learners, data.attendeesBySession])

  // ── Learner stats (over sessionsForTable) ─────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('attendance-asc')

  const stats = useMemo(() => {
    return filteredLearners.map((learner) => {
      let presentCount = 0
      const sessionStatuses: SessionWithStatus[] = []
      // sessionsForTable is already newest-first. Only count sessions this
      // learner was expected to attend — their own batch or "All" calls.
      for (const s of sessionsForTable) {
        if (s.batch !== 'All' && s.batch !== learner.batch) continue
        const isPresent = presentSet.has(
          `${s.meeting_code}::${s.date}::${learner.email}`,
        )
        if (isPresent) presentCount++
        sessionStatuses.push({
          meeting_code: s.meeting_code,
          name:         s.name,
          type:         s.type,
          date:         s.date,
          time:         s.time,
          status:       isPresent ? 'present' : 'absent',
        })
      }
      const expected = sessionStatuses.length
      const overallPct = expected ? Math.round((presentCount / expected) * 100) : 0
      const last6 = sessionStatuses.slice(0, 6)
      let consecMisses = 0
      for (const s of sessionStatuses) {
        if (s.status === 'absent') consecMisses++
        else break
      }
      const lastMissed = sessionStatuses.find((s) => s.status === 'absent')?.date ?? null
      return {
        id: learner.id,
        name: learner.name,
        email: learner.email,
        batch: learner.batch,
        overallPct,
        expected,
        presentCount,
        last6,
        consecMisses,
        lastMissed,
      }
    })
  }, [filteredLearners, sessionsForTable, presentSet])

  // ── Per-column filters ────────────────────────────────────────────────────
  const [nameQuery, setNameQuery] = useState('')
  const [batchFilter, setBatchFilter] = useState<Set<string>>(new Set())  // empty = no filter
  const [pctFilter,   setPctFilter]   = useState<Set<string>>(new Set())
  const [missFilter,  setMissFilter]  = useState<Set<string>>(new Set())

  const filteredSortedStats = useMemo(() => {
    let arr = stats
    if (nameQuery.trim()) {
      const q = nameQuery.trim().toLowerCase()
      arr = arr.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
    }
    if (batchFilter.size > 0) arr = arr.filter((s) => batchFilter.has(s.batch))
    if (pctFilter.size  > 0) arr = arr.filter((s) => pctFilter.has(pctBucket(s.overallPct, s.expected)))
    if (missFilter.size > 0) arr = arr.filter((s) => missFilter.has(missBucket(s.consecMisses)))

    const out = [...arr]
    if (sortKey === 'attendance-asc')  out.sort((a, b) => a.overallPct - b.overallPct)
    if (sortKey === 'attendance-desc') out.sort((a, b) => b.overallPct - a.overallPct)
    if (sortKey === 'name')            out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  }, [stats, sortKey, nameQuery, batchFilter, pctFilter, missFilter])

  // ── Modal state for click-to-view-learners ────────────────────────────────
  // Two flavours:
  // - { kind: 'absent',   learners: LearnerFlat[] }  — list of expected absentees
  // - { kind: 'attended', attendees: AttendeeFlat[] } — attendees with duration
  type Modal =
    | { kind: 'absent';   title: string; learners:  LearnerFlat[] }
    | { kind: 'attended'; title: string; attendees: AttendeeFlat[] }
  const [modal, setModal] = useState<Modal | null>(null)

  // ── Modal state for last-6 sessions per learner ───────────────────────────
  const [sessionsModal, setSessionsModal] = useState<{
    title:    string
    sessions: SessionWithStatus[]
  } | null>(null)

  async function handleSync() {
    setSyncMsg(null)
    startSync(async () => {
      try {
        const res = await fetch('/api/sync-attendance', { method: 'POST' })
        const j = await res.json()
        if (!res.ok) throw new Error(j.error || 'Sync failed')
        setSyncMsg(`Synced ${j.calls} calls and ${j.attendance} attendance rows.`)
        router.refresh()
      } catch (err) {
        setSyncMsg(`Sync failed: ${(err as Error).message}`)
      }
    })
  }

  if (data.batches.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center">
        <p className="text-sm text-zinc-500">No batches found. Run the learner roster sync first.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Filter row: Batches → Calls → Date + Sync */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MultiSelect
          label="Batches"
          options={data.batches.map((b) => ({ value: b, label: b }))}
          selected={selectedBatches}
          onChange={setSelectedBatches}
        />
        <MultiSelect
          label="Calls"
          options={callOptions.map((o) => ({ value: o.code, label: o.name }))}
          selected={selectedCalls}
          onChange={setSelectedCalls}
        />
        <DatePicker value={date} onChange={setDate} validDates={validDates} />

        <div className="ml-auto flex items-center gap-2">
          {syncMsg && <span className="text-xs text-zinc-500">{syncMsg}</span>}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {/* Cards */}
      {callSummaries.length === 0 ? (
        <div className="mb-6 rounded-xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
          No sessions match the current filters.
        </div>
      ) : (
        <div className="mb-6 flex flex-wrap gap-3">
          {callSummaries.map(({ session, attendees, absent }) => (
            <div key={`${session.meeting_code}::${session.date}`} className="min-w-[240px] rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                {session.type}{session.time ? ` · ${fmtTime(session.time)}` : ''}
                {session.batch && session.batch !== 'All' && ` · ${session.batch}`}
              </div>
              <div className="mt-1 text-sm font-bold text-zinc-900">{session.name}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">{formatDate(session.date)}</div>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setModal({
                    kind: 'attended',
                    title: `Attended — ${session.name} · ${formatDate(session.date)}`,
                    attendees,
                  })}
                  disabled={attendees.length === 0}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ✓ {attendees.length}
                </button>
                <button
                  type="button"
                  onClick={() => setModal({
                    kind: 'absent',
                    title: `Absent — ${session.name} · ${formatDate(session.date)}`,
                    learners: absent,
                  })}
                  disabled={absent.length === 0}
                  className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ✗ {absent.length}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Learners table */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <h2 className="text-sm font-bold text-zinc-900">
            Learners{' '}
            <span className="ml-1 text-xs font-medium text-zinc-400">
              ({filteredSortedStats.length}
              {filteredSortedStats.length !== filteredLearners.length && ` of ${filteredLearners.length}`})
            </span>
          </h2>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 focus:outline-none"
          >
            {SORT_OPTIONS.map((s) => <option key={s.key} value={s.key}>Sort: {s.label}</option>)}
          </select>
        </div>

        <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left">
                <Th>
                  <ThLabel>Name</ThLabel>
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
                    options={data.batches.map((b) => ({ value: b, label: b }))}
                    selected={batchFilter}
                    onChange={setBatchFilter}
                  />
                </Th>
                <Th>
                  <ThLabel>Overall %</ThLabel>
                  <ColumnFilter
                    options={PCT_BUCKETS.map((b) => ({ value: b, label: b }))}
                    selected={pctFilter}
                    onChange={setPctFilter}
                  />
                </Th>
                <Th>
                  <ThLabel>Last 6 sessions</ThLabel>
                  <div className="h-[22px]" />
                </Th>
                <Th>
                  <ThLabel>Consec. misses</ThLabel>
                  <ColumnFilter
                    options={MISS_BUCKETS.map((b) => ({ value: b, label: b }))}
                    selected={missFilter}
                    onChange={setMissFilter}
                  />
                </Th>
                <Th>
                  <ThLabel>Last missed</ThLabel>
                  <div className="h-[22px]" />
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredSortedStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center text-sm text-zinc-400">
                    No learners match the current filters.
                  </td>
                </tr>
              ) : (
                filteredSortedStats.map((s) => (
                  <LearnerRow
                    key={s.id}
                    s={s}
                    onLast6Click={() => setSessionsModal({
                      title:    `Last 6 sessions — ${s.name}`,
                      sessions: s.last6,
                    })}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Card-pill modal: attendees (with duration) or absentees (learners) */}
      {modal?.kind === 'absent' && (
        <LearnerListModal
          title={modal.title}
          learners={modal.learners}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'attended' && (
        <AttendeeListModal
          title={modal.title}
          attendees={modal.attendees}
          onClose={() => setModal(null)}
        />
      )}

      {/* Session-list modal (last-6 click) */}
      {sessionsModal && (
        <SessionListModal
          title={sessionsModal.title}
          sessions={sessionsModal.sessions}
          onClose={() => setSessionsModal(null)}
        />
      )}
    </div>
  )
}

// ── Subcomponents ───────────────────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label:    string
  options:  { value: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const allSelected = selected.size > 0 && selected.size === options.length
  const noneSelected = selected.size === 0
  const displayText =
    allSelected ? 'All' :
    noneSelected ? 'None' :
    selected.size === 1
      ? options.find((o) => o.value === Array.from(selected)[0])?.label ?? '1 selected'
      : `${selected.size} selected`

  function toggle(val: string) {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  function toggleAll() {
    if (allSelected) onChange(new Set())
    else onChange(new Set(options.map((o) => o.value)))
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium focus:outline-none ${
          allSelected || noneSelected ? 'border-zinc-300 text-zinc-700' : 'border-[#5BAE5B]/50 text-zinc-900'
        }`}
      >
        <span className="text-zinc-500">{label}:</span>
        <span className="max-w-[180px] truncate">{displayText}</span>
        <svg className="h-3 w-3 shrink-0 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 min-w-[220px] overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 border-b border-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]" />
            Select all
          </label>
          {options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-400">No options</p>
          ) : options.map((o) => (
            <label key={o.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]"
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function AttendeeListModal({
  title,
  attendees,
  onClose,
}: {
  title:     string
  attendees: AttendeeFlat[]
  onClose:   () => void
}) {
  // Sort by duration desc (longest first)
  const sorted = [...attendees].sort(
    (a, b) => (b.duration_minutes ?? 0) - (a.duration_minutes ?? 0),
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="pr-4 text-sm font-bold text-zinc-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-400">No attendees.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {sorted.map((a) => (
                <li key={a.email} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                    {a.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900">{a.name}</div>
                    <div className="truncate text-xs text-zinc-500">{a.email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[11px] font-bold tabular-nums text-zinc-700">
                      {fmtDuration(a.duration_minutes)}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {a.batch ?? 'external'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function fmtDuration(minutes: number | null): string {
  if (minutes == null) return '—'
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
}

function LearnerListModal({
  title,
  learners,
  onClose,
}: {
  title:    string
  learners: LearnerFlat[]
  onClose:  () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="pr-4 text-sm font-bold text-zinc-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {learners.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-400">No learners.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {learners.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
                    {l.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900">{l.name}</div>
                    <div className="truncate text-xs text-zinc-500">{l.email}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{l.batch}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function SessionListModal({
  title,
  sessions,
  onClose,
}: {
  title:    string
  sessions: SessionWithStatus[]
  onClose:  () => void
}) {
  // Render oldest-first inside the modal (matches the left→right square order).
  const ordered = [...sessions].reverse()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="pr-4 text-sm font-bold text-zinc-900">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {ordered.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-400">No sessions.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {ordered.map((s, i) => (
                <li key={`${s.meeting_code}::${s.date}::${i}`} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: s.status === 'present' ? '#dcfce7' : '#fee2e2',
                      color:           s.status === 'present' ? '#166534' : '#991b1b',
                    }}
                  >
                    {s.status === 'present' ? '✓' : '✗'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-zinc-900">{s.name}</div>
                    <div className="truncate text-xs text-zinc-500">
                      {s.type}{s.time ? ` · ${fmtTime(s.time)}` : ''} · {formatDate(s.date)}
                    </div>
                  </div>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                    style={{
                      backgroundColor: s.status === 'present' ? '#dcfce7' : '#fee2e2',
                      color:           s.status === 'present' ? '#166534' : '#991b1b',
                    }}
                  >
                    {s.status === 'present' ? 'Present' : 'Missed'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// Sticky <th> cell — keeps headers + filters in view as the body scrolls.
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="sticky top-0 z-10 bg-zinc-50 px-4 py-2 align-top">
      <div className="flex flex-col gap-1">{children}</div>
    </th>
  )
}

function ThLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
      {children}
    </span>
  )
}

// Compact multi-select for use inside a table header. Selecting nothing
// (selected.size === 0) means no filter.
function ColumnFilter({
  options,
  selected,
  onChange,
}: {
  options:  { value: string; label: string }[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  const label =
    selected.size === 0
      ? 'All'
      : selected.size === 1
        ? (options.find((o) => o.value === Array.from(selected)[0])?.label ?? '1')
        : `${selected.size} selected`

  function toggle(val: string) {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-1 rounded border bg-white px-2 py-0.5 text-left text-[11px] font-normal normal-case tracking-normal focus:outline-none ${
          selected.size > 0 ? 'border-[#5BAE5B] text-zinc-900' : 'border-zinc-200 text-zinc-500'
        }`}
      >
        <span className="truncate">{label}</span>
        <svg className="h-3 w-3 shrink-0 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-0.5 max-h-52 min-w-[140px] overflow-y-auto rounded border border-zinc-200 bg-white py-1 shadow-lg">
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => { onChange(new Set()); setOpen(false) }}
              className="w-full border-b border-zinc-100 px-3 py-1 text-left text-xs text-blue-500 hover:bg-zinc-50"
            >
              Clear filter
            </button>
          )}
          {options.length === 0 ? (
            <p className="px-3 py-1 text-xs text-zinc-400">No values</p>
          ) : options.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50">
              <input
                type="checkbox"
                checked={selected.has(opt.value)}
                onChange={() => toggle(opt.value)}
                className="h-3 w-3 rounded border-zinc-300 accent-[#5BAE5B]"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// Bucket helpers (must match the order shown in the dropdown)
const PCT_BUCKETS  = ['≥80%', '70–79%', '<70%', 'No data']
const MISS_BUCKETS = ['None', '1 in a row', '2+ in a row']

function pctBucket(pct: number, expected: number): string {
  if (expected === 0) return 'No data'
  if (pct >= 80) return '≥80%'
  if (pct >= 70) return '70–79%'
  return '<70%'
}

function missBucket(consec: number): string {
  if (consec === 0) return 'None'
  if (consec === 1) return '1 in a row'
  return '2+ in a row'
}

function LearnerRow({ s, onLast6Click }: {
  s: {
    id:           string
    name:         string
    email:        string
    batch:        string
    overallPct:   number
    last6:        SessionWithStatus[]
    consecMisses: number
    lastMissed:   string | null
  }
  onLast6Click: () => void
}) {
  const pctColor = s.overallPct >= 80 ? '#16a34a' : s.overallPct >= 70 ? '#f59e0b' : '#dc2626'
  const dotColor = s.overallPct >= 80 ? '#22c55e' : s.overallPct >= 70 ? '#f59e0b' : '#ef4444'
  const initials = s.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <tr className="hover:bg-zinc-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">
            {initials}
          </span>
          <span className="font-medium text-zinc-900">{s.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">{s.batch}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full" style={{ width: `${s.overallPct}%`, backgroundColor: pctColor }} />
          </div>
          <span className="text-xs font-bold" style={{ color: pctColor }}>{s.overallPct}%</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {s.last6.length === 0 ? (
          <span className="text-xs text-zinc-300">—</span>
        ) : (
          <button
            type="button"
            onClick={onLast6Click}
            className="-mx-1 flex gap-1 rounded-md px-1 py-1 transition-colors hover:bg-zinc-100"
            title="View these sessions"
          >
            {[...s.last6].reverse().map((session, i) => (
              <span
                key={i}
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: session.status === 'present' ? '#bbf7d0' : '#fecaca' }}
              />
            ))}
          </button>
        )}
      </td>
      <td className="px-4 py-3">
        {s.consecMisses === 0 ? (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">None</span>
        ) : s.consecMisses === 1 ? (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">1 in a row</span>
        ) : (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
            {s.consecMisses} in a row
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">{s.lastMissed ? formatDate(s.lastMissed) : '—'}</td>
    </tr>
  )
}

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ── Date picker — Pulse-styled wrapper around react-day-picker ────────────────

function DatePicker({
  value,
  onChange,
  validDates,
}: {
  value:      string
  onChange:   (iso: string) => void
  validDates: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  // Parse the ISO date as a local-midnight Date so the calendar shows the same
  // day regardless of timezone (react-day-picker uses local time). The empty
  // string represents "all dates" — no specific date selected.
  const isAllDates = value === ''
  const selectedDate = !isAllDates && value ? parseDate(value, 'yyyy-MM-dd', new Date()) : undefined
  const todayDate = new Date()

  function pick(d: Date | undefined) {
    if (!d) return
    onChange(fmt(d, 'yyyy-MM-dd'))
    setOpen(false)
  }

  // Greys-out dates with no sessions under the current filters.
  const isDisabled = (d: Date) => !validDates.has(fmt(d, 'yyyy-MM-dd'))

  // Open the calendar centered on the most recent valid date (or today).
  const defaultMonth = (() => {
    if (selectedDate) return selectedDate
    if (validDates.size > 0) {
      const latest = Array.from(validDates).sort().reverse()[0]
      return parseDate(latest, 'yyyy-MM-dd', new Date())
    }
    return todayDate
  })()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 text-sm font-medium transition-colors hover:bg-zinc-50 focus:outline-none ${
          open ? 'border-[#5BAE5B]' : 'border-zinc-300 text-zinc-700'
        }`}
        aria-label="Choose date"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" />
        </svg>
        <span>{isAllDates ? 'All dates' : formatDate(value)}</span>
        <svg className="h-3 w-3 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-lg">
          {/* "All dates" toggle — when active, the date filter is bypassed
              and the cards show every session matching batch+call filters. */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className={`mb-2 flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              isAllDates
                ? 'bg-[#5BAE5B] text-white'
                : 'text-zinc-700 hover:bg-zinc-100'
            }`}
          >
            <span>All dates</span>
            {isAllDates && (
              <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={pick}
            disabled={isDisabled}
            defaultMonth={defaultMonth}
            weekStartsOn={1}
            showOutsideDays
            today={todayDate}
            captionLayout="dropdown"
            startMonth={new Date(2024, 0)}
            endMonth={new Date(todayDate.getFullYear() + 1, 11)}
          />
          <div className="flex justify-between border-t border-zinc-100 pt-2">
            <button
              type="button"
              onClick={() => pick(todayDate)}
              disabled={!validDates.has(fmt(todayDate, 'yyyy-MM-dd'))}
              className="rounded-md px-2 py-1 text-xs font-medium text-[#5BAE5B] hover:bg-[#5BAE5B]/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtTime(t: string): string {
  const m = t.match(/^(\d{2}):(\d{2})/)
  if (!m) return t
  let h = parseInt(m[1], 10)
  const mm = m[2]
  const ampm = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  if (h > 12) h -= 12
  return `${h}:${mm} ${ampm}`
}
