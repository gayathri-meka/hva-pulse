import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import MatchingControls from '@/components/placements/MatchingControls'
import MatchingTable, { type MatchingRow, type MatchingStatus } from '@/components/placements/MatchingTable'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ role?: string; batch?: string; lf?: string }>
}

export default async function MatchingPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const { role: roleId, batch: batchFilter, lf: lfFilter } = await searchParams

  const supabase = await createServerSupabaseClient()

  // Always fetch: roles + companies (for dropdown), learners (for table + filters)
  // Conditionally fetch: applications + preferences only when a role is selected
  const [
    { data: roles },
    { data: companies },
    { data: rawLearners },
    { data: rawApplications },
    { data: rawPreferences },
  ] = await Promise.all([
    supabase.from('roles').select('id, company_id, role_title, status').order('created_at', { ascending: false }),
    supabase.from('companies').select('id, company_name'),
    supabase.from('learners').select('*, users!learners_user_id_fkey(name, email)'),
    roleId
      ? supabase.from('applications').select('user_id, status').eq('role_id', roleId)
      : Promise.resolve({ data: null, error: null }),
    roleId
      ? supabase.from('role_preferences').select('user_id').eq('role_id', roleId).eq('preference', 'not_interested')
      : Promise.resolve({ data: null, error: null }),
  ])

  // ── Build role options for dropdown ──────────────────────────────────────────
  const companyMap = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, c.company_name])
  )
  const roleOptions = (roles ?? [])
    .map((r) => ({
      id:           r.id,
      role_title:   r.role_title,
      company_name: companyMap[r.company_id] ?? '',
      status:       r.status,
    }))
    .sort((a, b) =>
      a.company_name.localeCompare(b.company_name) ||
      a.role_title.localeCompare(b.role_title)
    )

  // ── Flatten learners (join with users) ────────────────────────────────────
  type RawLearner = {
    learner_id: string; user_id: string | null; lf_name: string
    batch_name: string; users: { name: string; email: string } | null
  }
  const allLearners = ((rawLearners ?? []) as RawLearner[]).map((l) => ({
    learner_id: l.learner_id,
    user_id:    l.user_id,
    name:       l.users?.name ?? '',
    batch:      l.batch_name ?? '',
    lf:         l.lf_name ?? '',
  }))

  // ── Filter options ────────────────────────────────────────────────────────
  const batches = [...new Set(allLearners.map((l) => l.batch).filter(Boolean))].sort()
  const lfs     = [...new Set(allLearners.map((l) => l.lf).filter(Boolean))].sort()

  // ── Apply batch / LF filters ──────────────────────────────────────────────
  const filtered = allLearners
    .filter((l) => !batchFilter || l.batch === batchFilter)
    .filter((l) => !lfFilter    || l.lf    === lfFilter)
    .sort((a, b) => a.name.localeCompare(b.name))

  // ── Derive placement status per learner ──────────────────────────────────
  // Map user_id → application status
  const appMap = Object.fromEntries(
    (rawApplications ?? [])
      .filter((a) => a.user_id)
      .map((a) => [a.user_id!, a.status as MatchingStatus])
  )
  // Set of user_ids who marked not_interested
  const notInterestedSet = new Set(
    (rawPreferences ?? []).map((p) => p.user_id).filter(Boolean)
  )

  const rows: MatchingRow[] = !roleId ? [] : filtered.map((l) => {
    let status: MatchingStatus
    if (l.user_id && appMap[l.user_id]) {
      status = appMap[l.user_id]
    } else if (l.user_id && notInterestedSet.has(l.user_id)) {
      status = 'not_interested'
    } else {
      status = 'not_applied'
    }
    return {
      learner_id: l.learner_id,
      name:       l.name,
      batch:      l.batch,
      lf:         l.lf,
      prs_score:  null, // synced from Google Sheet later
      status,
    }
  })

  // ── Summary counts ────────────────────────────────────────────────────────
  const counts = {
    total:          rows.length,
    applied:        rows.filter((r) => r.status === 'applied').length,
    shortlisted:    rows.filter((r) => r.status === 'shortlisted').length,
    hired:          rows.filter((r) => r.status === 'hired').length,
    rejected:       rows.filter((r) => r.status === 'rejected').length,
    not_applied:    rows.filter((r) => r.status === 'not_applied').length,
    not_interested: rows.filter((r) => r.status === 'not_interested').length,
  }

  const summary = [
    { label: 'Total',         value: counts.total,          cls: 'bg-zinc-100 text-zinc-700' },
    { label: 'Applied',       value: counts.applied,        cls: 'bg-blue-100 text-blue-700' },
    { label: 'Shortlisted',   value: counts.shortlisted,    cls: 'bg-amber-100 text-amber-700' },
    { label: 'Hired',         value: counts.hired,          cls: 'bg-emerald-100 text-emerald-700' },
    { label: 'Rejected',      value: counts.rejected,       cls: 'bg-red-100 text-red-700' },
    { label: 'Not Applied',   value: counts.not_applied,    cls: 'bg-zinc-100 text-zinc-500' },
    { label: 'Not Interested',value: counts.not_interested, cls: 'bg-zinc-100 text-zinc-400' },
  ]

  return (
    <div className="space-y-6">

      {/* Controls */}
      <Suspense>
        <MatchingControls roles={roleOptions} batches={batches} lfs={lfs} />
      </Suspense>

      {/* Empty state — no role selected */}
      {!roleId && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-white py-24 text-center">
          <p className="text-sm font-medium text-zinc-500">Select a role above to see matching learners</p>
          <p className="mt-1 text-xs text-zinc-400">
            {roleOptions.length} role{roleOptions.length !== 1 ? 's' : ''} available
          </p>
        </div>
      )}

      {/* Role selected: summary + table */}
      {roleId && (
        <>
          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            {summary.map(({ label, value, cls }) => (
              <div
                key={label}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
              >
                <span>{value}</span>
                <span className="font-normal opacity-75">{label}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <MatchingTable rows={rows} />
        </>
      )}

    </div>
  )
}
