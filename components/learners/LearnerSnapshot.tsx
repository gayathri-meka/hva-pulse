import React from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SnapshotLearner = {
  learner_id:              string
  user_id:                 string | null
  name:                    string
  email:                   string
  phone_number:            string
  batch_name:              string
  status:                  string
  lf_name:                 string
  track:                   string
  category:                string
  join_date:               string | null
  tech_mentor_name:        string
  core_skills_mentor_name: string
  year_of_graduation:      number | null
  degree:                  string | null
  specialisation:          string | null
  current_location:        string | null
  prs:                     number | null
  readiness:               string | null
  blacklisted_date:        string | null
  proactiveness:           number | null
  articulation:            number | null
  comprehension:           number | null
  tech_score:              number | null
}

export type SnapshotApp = {
  id:                      string
  status:                  string
  created_at:              string
  not_shortlisted_reason:  string | null
  not_shortlisted_reasons: string[]
  rejection_feedback:      string | null
  rejection_reasons:       string[]
  role_title:              string
  company_name:            string
}

export type SnapshotDeclinedRole = {
  role_id:      string
  role_title:   string
  company_name: string
  reasons:      string[]
}

export type SnapshotResume = {
  file_url:     string
  version_name: string
  created_at:   string
} | null

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEARNER_STATUS_BADGE: Record<string, string> = {
  'Ongoing':       'bg-emerald-100 text-emerald-700',
  'On Hold':       'bg-orange-100 text-orange-700',
  'Dropout':       'bg-red-100 text-red-700',
  'Discontinued':  'bg-zinc-200 text-zinc-600',
  'Placed - Self': 'bg-blue-100 text-blue-700',
  'Placed - HVA':  'bg-violet-100 text-violet-700',
}

const READINESS_BADGE: Record<string, string> = {
  'Ready':        'bg-emerald-100 text-emerald-700',
  'Almost Ready': 'bg-amber-100 text-amber-700',
  'Not Ready':    'bg-red-100 text-red-700',
}

const APP_STATUS_BADGE: Record<string, string> = {
  applied:         'bg-blue-100 text-blue-700',
  shortlisted:     'bg-amber-100 text-amber-700',
  on_hold:         'bg-orange-100 text-orange-700',
  not_shortlisted: 'bg-zinc-100 text-zinc-600',
  rejected:        'bg-red-100 text-red-700',
  hired:           'bg-emerald-100 text-emerald-700',
}

const APP_STATUS_LABEL: Record<string, string> = {
  applied:         'Applied',
  shortlisted:     'Shortlisted',
  on_hold:         'On Hold',
  not_shortlisted: 'Not Shortlisted',
  rejected:        'Rejected',
  hired:           'Hired',
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">{label}</p>
      <p className="mt-0.5 text-sm text-zinc-700">
        {value != null && value !== '' ? value : <span className="text-zinc-300">—</span>}
      </p>
    </div>
  )
}

// PRS: 0–1 continuous bar
function PrsBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-zinc-300">—</span>
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-32 rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-[#5BAE5B]"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-500">{value.toFixed(2)}</span>
    </div>
  )
}

// 1–4 scores: filled dots
function ScoreDots({ value }: { value: number | null }) {
  if (value == null) return <span className="text-sm text-zinc-300">—</span>
  const rounded = Math.round(value)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i <= rounded ? 'bg-zinc-700' : 'bg-zinc-200'}`}
        />
      ))}
      <span className="ml-1 text-xs tabular-nums text-zinc-500">{value}</span>
    </div>
  )
}

function StatTile({
  label, count, border, bg, text,
}: {
  label: string; count: number; border: string; bg: string; text: string
}) {
  return (
    <div className={`flex flex-1 flex-col items-center rounded-xl border p-4 ${border} ${bg}`}>
      <p className={`text-2xl font-bold tabular-nums ${text}`}>{count}</p>
      <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-400 leading-tight">
        {label}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  learner:      SnapshotLearner
  apps:         SnapshotApp[]
  declinedRoles: SnapshotDeclinedRole[]
  resume:       SnapshotResume
}

export default function LearnerSnapshot({ learner, apps, declinedRoles, resume }: Props) {
  const initials = learner.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Placement counts
  const totalApps   = apps.length
  const shortlisted = apps.filter((a) => ['shortlisted', 'on_hold', 'hired', 'rejected'].includes(a.status)).length
  const inProcess   = apps.filter((a) => ['shortlisted', 'on_hold'].includes(a.status)).length
  const hired       = apps.filter((a) => a.status === 'hired').length
  const notSL       = apps.filter((a) => a.status === 'not_shortlisted').length
  const rejected    = apps.filter((a) => a.status === 'rejected').length
  const notInt      = declinedRoles.length

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-base font-bold text-zinc-500">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">{learner.name}</h2>
              <p className="text-sm text-zinc-500">{learner.email}</p>
              {(learner.phone_number || learner.current_location) && (
                <p className="text-xs text-zinc-400">
                  {[learner.phone_number, learner.current_location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </div>
          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEARNER_STATUS_BADGE[learner.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
            {learner.status}
          </span>
        </div>
        {learner.blacklisted_date && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Blacklisted · {fmtDate(learner.blacklisted_date)}
          </div>
        )}
      </div>

      {/* ── Academic + Assessment (left) | Programme (right) ──────────── */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left column: Academic stacked above Assessment */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Academic</h3>
            <div className="grid grid-cols-3 gap-x-6 gap-y-3">
              <InfoItem label="Degree"          value={learner.degree} />
              <InfoItem label="Specialisation"  value={learner.specialisation} />
              <InfoItem label="Graduation Year" value={learner.year_of_graduation} />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Assessment</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">PRS (0–1)</p>
                <PrsBar value={learner.prs} />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Readiness</p>
                {learner.readiness ? (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${READINESS_BADGE[learner.readiness] ?? 'bg-zinc-100 text-zinc-600'}`}>
                    {learner.readiness}
                  </span>
                ) : <span className="text-sm text-zinc-300">—</span>}
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Proactiveness (1–4)</p>
                <ScoreDots value={learner.proactiveness} />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Articulation (1–4)</p>
                <ScoreDots value={learner.articulation} />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Comprehension (1–4)</p>
                <ScoreDots value={learner.comprehension} />
              </div>
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Tech Score (1–4)</p>
                <ScoreDots value={learner.tech_score} />
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Programme */}
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Programme</h3>
          <div className="grid grid-cols-3 gap-x-6 gap-y-3">
            <InfoItem label="Batch"              value={learner.batch_name} />
            <InfoItem label="Track"              value={learner.track} />
            <InfoItem label="LF"                 value={learner.lf_name} />
            <InfoItem label="Tech Mentor"        value={learner.tech_mentor_name} />
            <InfoItem label="Core Skills Mentor" value={learner.core_skills_mentor_name} />
            <InfoItem label="Category"           value={learner.category} />
            <InfoItem label="Joined"             value={fmtDate(learner.join_date)} />
          </div>
        </div>
      </div>

      {/* ── Placement summary ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">Placement Summary</h3>
        <div className="flex gap-3">
          <StatTile label="Applied"          count={totalApps}   border="border-blue-100"    bg="bg-blue-50"    text="text-blue-700" />
          <StatTile label="Shortlisted"      count={shortlisted} border="border-amber-100"   bg="bg-amber-50"   text="text-amber-700" />
          <StatTile label="In Process"       count={inProcess}   border="border-orange-100"  bg="bg-orange-50"  text="text-orange-700" />
          <StatTile label="Hired"            count={hired}       border="border-emerald-100" bg="bg-emerald-50" text="text-emerald-700" />
          <StatTile label="Not Shortlisted"  count={notSL}       border="border-zinc-200"    bg="bg-zinc-50"    text="text-zinc-600" />
          <StatTile label="Rejected"         count={rejected}    border="border-red-100"     bg="bg-red-50"     text="text-red-600" />
          <StatTile label="Not Interested"   count={notInt}      border="border-zinc-200"    bg="bg-zinc-50"    text="text-zinc-500" />
        </div>
      </div>

      {/* ── Resume ─────────────────────────────────────────────────────── */}
      {resume && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Resume</h3>
          <a
            href={resume.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0-6a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5z" clipRule="evenodd" />
            </svg>
            {resume.version_name}
            <span className="text-zinc-400">·</span>
            <span className="text-zinc-400 text-xs">{fmtDate(resume.created_at)}</span>
          </a>
        </div>
      )}

      {/* ── Application history ─────────────────────────────────────────── */}
      {apps.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Application History ({apps.length})
          </h3>
          <div className="space-y-2">
            {apps.map((app) => (
              <div key={app.id} className="rounded-lg border border-zinc-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm">
                    <span className="font-medium text-zinc-900">{app.company_name}</span>
                    <span className="mx-1.5 text-zinc-300">·</span>
                    <span className="text-zinc-500">{app.role_title}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${APP_STATUS_BADGE[app.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {APP_STATUS_LABEL[app.status] ?? app.status}
                    </span>
                    <span className="text-xs text-zinc-400">{fmtDate(app.created_at)}</span>
                  </div>
                </div>

                {/* Not-shortlisted reasons — only for not_shortlisted status */}
                {app.status === 'not_shortlisted' && app.not_shortlisted_reasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.not_shortlisted_reasons.map((r) => (
                      <span key={r} className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{r}</span>
                    ))}
                  </div>
                )}
                {app.status === 'not_shortlisted' && app.not_shortlisted_reason && app.not_shortlisted_reasons.length === 0 && (
                  <p className="mt-1.5 text-xs text-zinc-500">{app.not_shortlisted_reason}</p>
                )}

                {/* Rejection feedback — only for rejected status */}
                {app.status === 'rejected' && app.rejection_reasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {app.rejection_reasons.map((r) => (
                      <span key={r} className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-500">{r}</span>
                    ))}
                  </div>
                )}
                {app.status === 'rejected' && app.rejection_feedback && (
                  <p className="mt-1.5 text-xs text-zinc-500">{app.rejection_feedback}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Declined roles ──────────────────────────────────────────────── */}
      {declinedRoles.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Declined Roles ({declinedRoles.length})
          </h3>
          <div className="space-y-2">
            {declinedRoles.map((role) => (
              <div key={role.role_id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-100 p-3">
                <p className="text-sm">
                  <span className="font-medium text-zinc-900">{role.company_name}</span>
                  <span className="mx-1.5 text-zinc-300">·</span>
                  <span className="text-zinc-500">{role.role_title}</span>
                </p>
                {role.reasons.length > 0 && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {role.reasons.map((r) => (
                      <span key={r} className="inline-flex rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
