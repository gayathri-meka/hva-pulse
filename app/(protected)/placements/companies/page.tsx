import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AddCompanyButton from '@/components/placements/AddCompanyButton'
import CompaniesListClient from '@/components/placements/CompaniesListClient'
import type { CompanyWithRoles, RoleWithCounts } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: companies }, { data: roles }, { data: applications }, { data: notInterested }] = await Promise.all([
    supabase.from('companies').select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true }),
    supabase.from('roles').select('*').order('created_at', { ascending: true }),
    supabase.from('applications').select('role_id, status'),
    supabase.from('role_preferences').select('role_id').eq('preference', 'not_interested'),
  ])

  // Build a count map of not-interested per role
  const niMap: Record<string, number> = {}
  for (const p of notInterested ?? []) {
    niMap[p.role_id] = (niMap[p.role_id] ?? 0) + 1
  }

  const companiesWithRoles: CompanyWithRoles[] = (companies ?? []).map((c) => {
    const companyRoles: RoleWithCounts[] = (roles ?? [])
      .filter((r) => r.company_id === c.id)
      .map((r) => {
        const roleApps = (applications ?? []).filter((a) => a.role_id === r.id)
        return {
          ...r,
          applicant_count:      roleApps.length,
          hired_count:          roleApps.filter((a) => a.status === 'hired').length,
          not_interested_count: niMap[r.id] ?? 0,
        }
      })
    return { ...c, roles: companyRoles }
  })

  const totalRoles     = companiesWithRoles.reduce((s, c) => s + c.roles.length, 0)
  const openRoles      = companiesWithRoles.reduce((s, c) => s + c.roles.filter((r) => r.status === 'open').length, 0)
  const openCompanies  = companiesWithRoles.filter((c) => c.roles.some((r) => r.status === 'open')).length

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">
          {companiesWithRoles.length} compan{companiesWithRoles.length !== 1 ? 'ies' : 'y'}
          {' · '}
          {totalRoles} role{totalRoles !== 1 ? 's' : ''}
          {openRoles > 0 && (
            <>
              {' · '}
              <span className="text-emerald-600">{openRoles} open</span>
            </>
          )}
        </p>
        <AddCompanyButton />
      </div>

      {companiesWithRoles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-sm text-zinc-400">No companies yet. Add your first one above.</p>
        </div>
      ) : (
        <CompaniesListClient companies={companiesWithRoles} />
      )}
    </div>
  )
}
