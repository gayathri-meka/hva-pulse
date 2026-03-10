import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ResumeManager from '@/components/learner/ResumeManager'
import { signOut } from '@/app/actions'

export const dynamic = 'force-dynamic'

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

function fmtDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso.includes('T') ? iso : iso + 'T00:00:00')
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

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

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ back?: string }>
}

export default async function ProfilePage({ searchParams }: Props) {
  const { back } = await searchParams
  const backHref = back?.startsWith('/learner/roles/') ? back : null
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const [{ data: resumes }, { data: learner }] = await Promise.all([
    supabase
      .from('resumes')
      .select('id, version_name, file_url, created_at')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('learners')
      .select('*')
      .eq('user_id', appUser.id)
      .maybeSingle(),
  ])

  const initials = (appUser.name ?? appUser.email)
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      {backHref && (
        <Link
          href={backHref}
          className="mb-1 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to role
        </Link>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-zinc-900">Profile</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            Sign out
          </button>
        </form>
      </div>

      {/* ── Profile header ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-base font-bold text-zinc-500">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900">{appUser.name ?? '—'}</h2>
              <p className="text-sm text-zinc-500">{appUser.email}</p>
              {(learner?.phone_number || learner?.current_location) && (
                <p className="text-xs text-zinc-400">
                  {[learner.phone_number, learner.current_location].filter(Boolean).join(' · ')}
                </p>
              )}
              {learner?.learner_id && (
                <p className="mt-0.5 text-xs text-zinc-400">
                  Learner ID: <span className="font-mono">{learner.learner_id}</span>
                </p>
              )}
            </div>
          </div>
          {learner?.status && (
            <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${LEARNER_STATUS_BADGE[learner.status] ?? 'bg-zinc-100 text-zinc-600'}`}>
              {learner.status}
            </span>
          )}
        </div>
        {learner?.blacklisted_date && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            Blacklisted · {fmtDate(learner.blacklisted_date)}
          </div>
        )}
      </div>

      {/* ── Resume management ───────────────────────────────────────────── */}
      <div>
        <h2 className="mb-1 text-sm font-semibold text-zinc-700">My Resumes</h2>
        <p className="mb-3 text-xs text-zinc-600">
          Save different versions here — e.g. one for tech roles and one for non-tech roles.
          You&apos;ll choose which to use when applying.
        </p>
        <ResumeManager resumes={resumes ?? []} />
      </div>

      {/* ── Academic ────────────────────────────────────────────────────── */}
      {learner && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Academic</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <InfoItem label="Degree"          value={learner.degree} />
            <InfoItem label="Specialisation"  value={learner.specialisation} />
            <InfoItem label="Graduation Year" value={learner.year_of_graduation} />
          </div>
        </div>
      )}

      {/* ── Programme ───────────────────────────────────────────────────── */}
      {learner && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Programme</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <InfoItem label="Batch"              value={learner.batch_name} />
            <InfoItem label="Track"              value={learner.track} />
            <InfoItem label="LF"                 value={learner.lf_name} />
            <InfoItem label="Tech Mentor"        value={learner.tech_mentor_name} />
            <InfoItem label="Core Skills Mentor" value={learner.core_skills_mentor_name} />
            <InfoItem label="Category"           value={learner.category} />
            <InfoItem label="Joined"             value={fmtDate(learner.join_date)} />
          </div>
        </div>
      )}

      {/* ── Assessment ──────────────────────────────────────────────────── */}
      {learner && (
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
      )}
    </div>
  )
}
