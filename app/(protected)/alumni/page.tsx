import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AlumniFilters from '@/components/alumni/AlumniFilters'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ fy?: string; status?: string }>
}

type AlumniJob = {
  company:        string
  role:           string
  salary:         number | null
  placement_month: string | null
  is_current:     boolean
}

type AlumniRow = {
  id:                string
  name:              string
  email:             string | null
  fy_year:           string
  employment_status: string
  contact_number:    string | null
  alumni_jobs:       AlumniJob[]
}

export default async function AlumniPage({ searchParams }: Props) {
  const { fy, status } = await searchParams

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'LF') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  // Unfiltered query for FY year options
  const { data: allAlumni } = await supabase
    .from('alumni')
    .select('fy_year')

  const fyYears = Array.from(
    new Set((allAlumni ?? []).map((a) => a.fy_year).filter(Boolean))
  ).sort() as string[]

  // Filtered query
  let query = supabase
    .from('alumni')
    .select('*, alumni_jobs(company, role, salary, placement_month, is_current)')
    .order('name')

  if (fy)     query = query.eq('fy_year', fy)
  if (status) query = query.eq('employment_status', status)

  const { data: rawAlumni } = await query
  const alumni = (rawAlumni ?? []) as AlumniRow[]

  const employedCount   = alumni.filter((a) => a.employment_status === 'employed').length
  const unemployedCount = alumni.filter((a) => a.employment_status === 'unemployed').length

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Alumni</h1>
        <p className="mt-1 text-sm text-zinc-500">Placed learners across all cohorts</p>
      </div>

      {/* Filters */}
      <Suspense>
        <AlumniFilters fyYears={fyYears} />
      </Suspense>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Total Alumni</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{alumni.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Employed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{employedCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Unemployed</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{unemployedCount}</p>
        </div>
      </div>

      {/* Table */}
      <p className="mb-2 text-sm text-zinc-500">
        {alumni.length} alumni
      </p>
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Name</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Email</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">FY Year</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Company</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Role</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Salary</th>
                <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {alumni.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-zinc-400">
                    No alumni records found.
                  </td>
                </tr>
              ) : (
                alumni.map((a) => {
                  const currentJob = a.alumni_jobs.find((j) => j.is_current) ?? a.alumni_jobs[0] ?? null
                  return (
                    <tr key={a.id} className="hover:bg-zinc-50">
                      <td className="px-6 py-3.5 font-medium text-zinc-900">{a.name}</td>
                      <td className="px-6 py-3.5 text-zinc-500">{a.email ?? '—'}</td>
                      <td className="px-6 py-3.5 text-zinc-600">{a.fy_year}</td>
                      <td className="px-6 py-3.5">
                        {a.employment_status === 'employed' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                            Employed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            Unemployed
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-600">{currentJob?.company ?? '—'}</td>
                      <td className="px-6 py-3.5 text-zinc-600">{currentJob?.role ?? '—'}</td>
                      <td className="px-6 py-3.5 text-zinc-600">
                        {currentJob?.salary != null ? `${currentJob.salary} LPA` : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-500">{a.contact_number ?? '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
