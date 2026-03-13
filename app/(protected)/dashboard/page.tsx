import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import PlacementHealth from '@/components/placements/PlacementHealth'
import DashboardFilters from '@/components/dashboard/DashboardFilters'
import type { PlacementThresholds } from '@/app/(protected)/placements/analytics/actions'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ lf?: string; batch?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const firstName = appUser.name?.split(' ')[0] ?? appUser.email.split('@')[0]
  const { lf, batch } = await searchParams
  const supabase = await createServerSupabaseClient()

  // ── Learner data ─────────────────────────────────────────────────────────
  const [{ data: allLearners }, { data: filteredLearners }] = await Promise.all([
    supabase.from('learners').select('status, lf_name, batch_name'),
    (lf || batch)
      ? (() => {
          let q = supabase.from('learners').select('user_id, status')
          if (lf)    q = q.eq('lf_name',    lf)
          if (batch) q = q.eq('batch_name', batch)
          return q
        })()
      : Promise.resolve({ data: null, error: null }),
  ])

  const lfs     = Array.from(new Set(allLearners?.map((l) => l.lf_name).filter(Boolean))).sort()    as string[]
  const batches = Array.from(new Set(allLearners?.map((l) => l.batch_name).filter(Boolean))).sort() as string[]

  const funnelLearners = filteredLearners ?? allLearners ?? []
  const filterUserIds  = filteredLearners
    ? filteredLearners.map((l) => l.user_id).filter((id): id is string => !!id)
    : null

  // ── Funnel counts ─────────────────────────────────────────────────────────
  const count     = (status: string) => funnelLearners.filter((l) => l.status === status).length
  const total      = funnelLearners.length
  const dropout    = count('Dropout')
  const discontinued = count('Discontinued')
  const placedSelf = count('Placed - Self')
  const placedHVA  = count('Placed - HVA')
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

  const [{ data: roles }, { data: applications }, { data: preferences }, { data: settingsRow }] = await Promise.all([
    supabase.from('roles').select('id, created_at, status'),
    appsQuery,
    prefsQuery,
    supabase.from('settings').select('value').eq('key', 'placement_thresholds').single(),
  ])

  const DEFAULT_THRESHOLDS: PlacementThresholds = { demand_target: 10, engagement_target: 5, conversion_target: 0.5 }
  const thresholds: PlacementThresholds = (settingsRow?.value as PlacementThresholds) ?? DEFAULT_THRESHOLDS

  const allApps    = applications ?? []
  const totalRoles = roles?.length ?? 0
  const totalApps  = allApps.length
  const openRoles  = roles?.filter((r) => r.status === 'open').length ?? 0

  // Weekly role addition rate (last 4 weeks)
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const startOfCurrentWeek = new Date(now)
  startOfCurrentWeek.setHours(0, 0, 0, 0)
  startOfCurrentWeek.setDate(now.getDate() - dayOfWeek)

  const weekCounts: Record<number, number> = {}
  for (const role of roles ?? []) {
    if (!role.created_at) continue
    const diffMs  = startOfCurrentWeek.getTime() - new Date(role.created_at).getTime()
    const weeksAgo = Math.max(0, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)))
    weekCounts[weeksAgo] = (weekCounts[weeksAgo] ?? 0) + 1
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

  // Build learners URL with current lf/batch filters carried over
  function learnersUrl(status: string) {
    const params = new URLSearchParams()
    params.set('status', status)
    if (lf)    params.set('lf',    lf)
    if (batch) params.set('batch', batch)
    return `/learners?${params.toString()}`
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Hi, {firstName}!</h1>
        <p className="mt-1 text-sm text-zinc-500">Programme overview</p>
      </div>

      <Suspense>
        <DashboardFilters lfs={lfs} batches={batches} />
      </Suspense>

      {/* ── Learner Journey Funnel ─────────────────────────────────────── */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
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
              className="ml-2 flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 transition-opacity hover:opacity-75"
            >
              <span className="text-sm font-semibold tabular-nums text-red-600">{exited}</span>
              <span className="text-xs text-red-400">exited</span>
              {exited > 0 && (
                <span className="ml-1 text-[11px] text-red-300">
                  {[dropout > 0 && `${dropout} dropout`, discontinued > 0 && `${discontinued} discontinued`]
                    .filter(Boolean)
                    .join(' · ')}
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
        <div className="mt-2 grid grid-cols-3 gap-3">
          <Link
            href={learnersUrl('Placed - Self')}
            className="rounded-lg border border-blue-100 bg-blue-50 p-3 transition-opacity hover:opacity-75"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-500">Placed — Self</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{placedSelf}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {continued > 0 ? Math.round((placedSelf / continued) * 100) : 0}% of continued
            </p>
          </Link>
          <Link
            href={learnersUrl('Placed - HVA')}
            className="rounded-lg border border-violet-100 bg-violet-50 p-3 transition-opacity hover:opacity-75"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-violet-500">Placed — HVA</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{placedHVA}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {continued > 0 ? Math.round((placedHVA / continued) * 100) : 0}% of continued
            </p>
          </Link>
          <Link
            href={learnersUrl('Ongoing')}
            className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 transition-opacity hover:opacity-75"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Ongoing</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-900">{ongoing}</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {continued > 0 ? Math.round((ongoing / continued) * 100) : 0}% of continued
            </p>
          </Link>
        </div>
      </div>

      {/* ── Placement Health ───────────────────────────────────────────── */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <PlacementHealth
          openRoles={openRoles}
          weeklyAvg={weeklyAvg}
          appsPerRole={appsPerRole}
          notInterestedRate={notInterestedRate}
          shortlistRate={shortlistRate}
          hireRate={hireRate}
          totalRoles={totalRoles}
          totalApps={totalApps}
          thresholds={thresholds}
          isAdmin={false}
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
  )
}
