import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import PlacementHealth from '@/components/placements/PlacementHealth'
import DashboardFilters from '@/components/dashboard/DashboardFilters'
import { buildProspectIndex, matchSignup } from '@/lib/signupMatch'
import { challengeFunnel, CHALLENGE_VIEW } from '@/lib/challengeFunnel'
import type { PlacementThresholds } from '@/app/(protected)/placements/analytics/actions'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ lf?: string; batch?: string; sub_cohort?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const firstName = appUser.name?.split(' ')[0] ?? appUser.email.split('@')[0]
  const { lf, batch, sub_cohort } = await searchParams
  const subCohorts = sub_cohort ? sub_cohort.split(',').filter(Boolean) : []
  const supabase = await createServerSupabaseClient()

  // ── Learner data ─────────────────────────────────────────────────────────
  // funnelLearners: filtered by lf + batch + sub_cohort (learner journey only)
  // healthLearners: filtered by lf + batch only (placement health — sub_cohort excluded)
  const [{ data: allLearners }, { data: funnelFiltered }, { data: healthFiltered }] = await Promise.all([
    supabase.from('learners').select('status, lf_name, batch_name, sub_cohort').eq('is_current_cohort', true),
    (lf || batch || subCohorts.length > 0)
      ? (() => {
          let q = supabase.from('learners').select('user_id, status').eq('is_current_cohort', true)
          if (lf)                q = q.eq('lf_name',    lf)
          if (batch)             q = q.eq('batch_name', batch)
          if (subCohorts.length) q = q.in('sub_cohort', subCohorts)
          return q
        })()
      : Promise.resolve({ data: null, error: null }),
    (lf || batch)
      ? (() => {
          let q = supabase.from('learners').select('user_id').eq('is_current_cohort', true)
          if (lf)    q = q.eq('lf_name',    lf)
          if (batch) q = q.eq('batch_name', batch)
          return q
        })()
      : Promise.resolve({ data: null, error: null }),
  ])

  const lfs              = Array.from(new Set(allLearners?.map((l) => l.lf_name).filter(Boolean))).sort()    as string[]
  const batches          = Array.from(new Set(allLearners?.map((l) => l.batch_name).filter(Boolean))).sort() as string[]
  const subCohortOptions = Array.from(new Set(allLearners?.map((l) => l.sub_cohort).filter(Boolean))).sort() as string[]

  const funnelLearners = funnelFiltered ?? allLearners ?? []
  const filterUserIds  = healthFiltered
    ? healthFiltered.map((l) => l.user_id).filter((id): id is string => !!id)
    : null

  // ── Funnel counts ─────────────────────────────────────────────────────────
  const count     = (status: string) => funnelLearners.filter((l) => l.status === status).length
  const total      = funnelLearners.length
  const dropout    = count('Dropout')
  const discontinued = count('Discontinued')
  const placedSelf = count('Placed - Self')
  const placedHVA  = count('Placed - HVA')
  const placedTotal = placedSelf + placedHVA
  const ongoing    = count('Ongoing')
  const exited     = dropout + discontinued
  const continued  = total - exited

  // ── Placement health queries ──────────────────────────────────────────────
  let appsQuery  = supabase.from('applications').select('status')
  let prefsQuery = supabase.from('role_preferences').select('id').eq('preference', 'not_interested')
  if (filterUserIds) {
    appsQuery  = appsQuery.in('user_id',  filterUserIds)
    prefsQuery = prefsQuery.in('user_id', filterUserIds)
  }

  const [{ data: roles }, { data: applications }, { data: preferences }, { data: settingsRow }, { data: roleProcessApps }] = await Promise.all([
    supabase.from('roles').select('id, created_at, status'),
    appsQuery,
    prefsQuery,
    supabase.from('settings').select('value').eq('key', 'placement_thresholds').single(),
    supabase.from('applications').select('role_id, status'), // global — demand is not learner-scoped
  ])

  const DEFAULT_THRESHOLDS: PlacementThresholds = { demand_target: 10, engagement_target: 5, conversion_target: 0.5 }
  const thresholds: PlacementThresholds = (settingsRow?.value as PlacementThresholds) ?? DEFAULT_THRESHOLDS

  const allApps    = applications ?? []
  const totalRoles = roles?.length ?? 0
  const totalApps  = allApps.length
  // Demand = roles with at least one application still in an active (non-terminal) stage.
  const TERMINAL_APP_STATUSES = new Set(['hired', 'rejected', 'not_shortlisted'])
  const ongoingRoles = new Set(
    (roleProcessApps ?? [])
      .filter((a) => a.role_id && !TERMINAL_APP_STATUSES.has(a.status))
      .map((a) => a.role_id)
  ).size

  // Weekly role addition rate (last 4 weeks)
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const startOfCurrentWeek = new Date(now)
  startOfCurrentWeek.setHours(0, 0, 0, 0)
  startOfCurrentWeek.setDate(now.getDate() - dayOfWeek)

  const weekCounts: Record<number, number> = {}
  for (const role of roles ?? []) {
    if (!role.created_at) continue
    const d = new Date(role.created_at)
    const roleDow = d.getDay() === 0 ? 6 : d.getDay() - 1
    const roleMonday = new Date(d)
    roleMonday.setHours(0, 0, 0, 0)
    roleMonday.setDate(d.getDate() - roleDow)
    const diffMs  = startOfCurrentWeek.getTime() - roleMonday.getTime()
    const weeksAgo = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
    if (weeksAgo >= 0) weekCounts[weeksAgo] = (weekCounts[weeksAgo] ?? 0) + 1
  }
  const last4 = [0, 1, 2, 3].map((w) => weekCounts[w] ?? 0)
  const weeklyAvg = last4.reduce((s, c) => s + c, 0) / 4

  const hired           = allApps.filter((a) => a.status === 'hired').length
  const rejected        = allApps.filter((a) => a.status === 'rejected').length
  const yetToStart      = allApps.filter((a) => a.status === 'shortlisted').length
  const interviewsOngoing = allApps.filter((a) => a.status === 'interviews_ongoing').length
  const onHold          = allApps.filter((a) => a.status === 'on_hold').length
  const shortlistPassed = yetToStart + interviewsOngoing + onHold + hired + rejected
  const notInterested   = preferences?.length ?? 0

  const appsPerRole       = totalRoles > 0 ? totalApps / totalRoles : 0
  const notInterestedRate = (totalApps + notInterested) > 0 ? notInterested / (totalApps + notInterested) : 0
  const shortlistRate     = totalApps > 0 ? shortlistPassed / totalApps : 0
  const hireRate          = (hired + rejected) > 0 ? hired / (hired + rejected) : 0

  // ── Admissions funnel (global — top-of-funnel, not learner-filtered) ───────
  // learner_applications + prospects have RLS that blocks authenticated SELECTs,
  // so read via the service-role client (same pattern as the admissions pages).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: challengeSrc } = await admin
    .from('metric_sources')
    .select('id')
    .eq('bq_table', CHALLENGE_VIEW)
    .maybeSingle()

  const [{ data: hits }, { data: prospects }, { data: challengeRows }] = await Promise.all([
    admin.from('learner_applications').select('email, signup_token, signed_up_at'),
    admin.from('prospects').select('email, signup_token'),
    challengeSrc
      ? admin.from('metric_raw_rows').select('learner_id, dimensions').eq('source_id', challengeSrc.id).limit(20000)
      : Promise.resolve({ data: [] as { learner_id: string | null; dimensions: Record<string, string | null> | null }[] }),
  ])

  const normEmail = (e: string | null) => (e ?? '').trim().toLowerCase()
  const prospectIndex   = buildProspectIndex(prospects ?? [])
  const uniqueHitEmails = new Set<string>()
  const convertedEmails = new Set<string>()
  for (const h of hits ?? []) {
    const e = normEmail(h.email)
    if (e) uniqueHitEmails.add(e)
    const match = matchSignup(h, prospectIndex)
    if (match.matched) convertedEmails.add(match.prospectEmail || e)
  }
  const uniqueHits       = uniqueHitEmails.size
  const signedUp         = convertedEmails.size
  const startedChallenge = challengeFunnel(challengeRows ?? []).started

  // Build learners URL with current lf/batch filters carried over
  function learnersUrl(status: string) {
    const params = new URLSearchParams()
    params.set('status', status)
    params.set('fy', 'all')
    if (lf)                params.set('lf',         lf)
    if (batch)             params.set('batch',       batch)
    if (subCohorts.length) params.set('sub_cohort',  subCohorts.join(','))
    return `/learners?${params.toString()}`
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">Hi, {firstName}!</h1>
        <Suspense>
          <DashboardFilters lfs={lfs} batches={batches} subCohorts={subCohortOptions} />
        </Suspense>
      </div>

      <div className="mb-8 grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      {/* ── Learner Journey Funnel ─────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-zinc-400">Learner Journey</p>

        {/* Stage 1 — Enrolled */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tabular-nums text-zinc-900">{total}</span>
          <span className="text-sm text-zinc-500">learners enrolled</span>
        </div>

        {/* Connector + exits */}
        <div className="ml-[18px] mt-1 flex">
          <div className="flex flex-col items-center">
            <div className="w-px flex-1 bg-zinc-200" />
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
            <div className="w-px flex-1 bg-zinc-200" />
          </div>
          <div className="ml-4 flex items-center self-center">
            <div className="h-px w-4 bg-zinc-200" />
            <Link
              href={learnersUrl('Dropout,Discontinued')}
              className="ml-2 flex flex-col gap-0.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 transition-opacity hover:opacity-75"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold tabular-nums text-red-600">{exited}</span>
                <span className="text-xs text-red-400">exited</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="ml-0.5 h-3 w-3 text-red-300">
                  <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
                </svg>
              </div>
              {total > 0 && (
                <span className="text-[11px] text-red-400">
                  {Math.round((exited / total) * 100)}% of enrolled
                  {exited > 0 &&
                    ` · ${[dropout > 0 && `${dropout} dropout`, discontinued > 0 && `${discontinued} discontinued`]
                      .filter(Boolean)
                      .join(' · ')}`}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Stage 2 — Continued */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums text-zinc-900">{continued}</span>
          <span className="text-sm text-zinc-500">continued in programme</span>
        </div>

        {/* Connector to outcomes */}
        <div className="ml-[18px] mt-1 flex">
          <div className="flex flex-col items-center">
            <div className="w-px flex-1 bg-zinc-200" />
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          </div>
        </div>

        {/* Stage 3 — Outcomes */}
        <div className="mt-2 grid grid-cols-2 gap-3">
          {/* Combined Placed — total prominent, self/HVA breakdown secondary */}
          <Link
            href={learnersUrl('Placed - Self,Placed - HVA')}
            className="flex flex-col rounded-lg border border-emerald-100 bg-emerald-50 p-4 transition-opacity hover:opacity-75"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Placed</p>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-emerald-300">
                <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{placedTotal}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              <span className="font-semibold text-emerald-500">{continued > 0 ? Math.round((placedTotal / continued) * 100) : 0}%</span> of continued
              {' · '}
              <span className="font-semibold text-emerald-500">{total > 0 ? Math.round((placedTotal / total) * 100) : 0}%</span> of total
            </p>
            <p className="mt-2 text-[11px] text-zinc-400">
              <span className="font-medium text-blue-500">{placedSelf}</span> self · <span className="font-medium text-violet-500">{placedHVA}</span> HVA
            </p>
          </Link>
          <Link
            href={learnersUrl('Ongoing')}
            className="flex flex-col rounded-lg border border-blue-100 bg-blue-50 p-4 transition-opacity hover:opacity-75"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">Ongoing</p>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 text-blue-300">
                <path fillRule="evenodd" d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 0 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{ongoing}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              <span className="font-semibold text-blue-500">{continued > 0 ? Math.round((ongoing / continued) * 100) : 0}%</span> of continued
              {' · '}
              <span className="font-semibold text-blue-500">{total > 0 ? Math.round((ongoing / total) * 100) : 0}%</span> of total
            </p>
          </Link>
        </div>
      </div>

      {/* ── Placement Health ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <PlacementHealth
          ongoingRoles={ongoingRoles}
          weeklyAvg={weeklyAvg}
          appsPerRole={appsPerRole}
          notInterestedRate={notInterestedRate}
          shortlistRate={shortlistRate}
          hireRate={hireRate}
          totalRoles={totalRoles}
          totalApps={totalApps}
          thresholds={thresholds}
          isAdmin={false}
          showFocusArea={false}
        />
        <div className="mt-3 flex justify-end">
          <Link
            href="/placements/analytics"
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600"
          >
            View full analytics →
          </Link>
        </div>
      </div>
      </div>

      {/* ── Admissions Funnel ──────────────────────────────────────────── */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Admissions</p>
          <Link
            href="/admissions/analytics"
            className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-600"
          >
            View admissions analytics →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/admissions/analytics"
            className="flex flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-opacity hover:opacity-75"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Unique website hits</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{uniqueHits.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-zinc-400">unique visitors by email</p>
          </Link>
          <Link
            href="/admissions/analytics"
            className="flex flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-opacity hover:opacity-75"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Signed up to Pulse</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{signedUp.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              <span className="font-semibold text-[#5BAE5B]">{uniqueHits > 0 ? Math.round((signedUp / uniqueHits) * 100) : 0}%</span> of unique hits
            </p>
          </Link>
          <Link
            href="/admissions/analytics"
            className="flex flex-col rounded-lg border border-zinc-200 bg-zinc-50 p-4 transition-opacity hover:opacity-75"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Started challenge</p>
            <p className="mt-2 text-3xl font-bold tabular-nums text-zinc-900">{startedChallenge.toLocaleString()}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              <span className="font-semibold text-[#5BAE5B]">{signedUp > 0 ? Math.round((startedChallenge / signedUp) * 100) : 0}%</span> of signups
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
