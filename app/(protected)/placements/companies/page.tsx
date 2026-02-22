import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import AddCompanyButton from '@/components/placements/AddCompanyButton'
import CompanyAccordion from '@/components/placements/CompanyAccordion'
import type { CompanyWithRoles, RoleWithCounts } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CompaniesPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [{ data: companies }, { data: roles }, { data: applications }] = await Promise.all([
    supabase.from('companies').select('*').order('created_at', { ascending: false }),
    supabase.from('roles').select('*').order('created_at', { ascending: false }),
    supabase.from('applications').select('role_id, status'),
  ])

  const companiesWithRoles: CompanyWithRoles[] = (companies ?? []).map((c) => {
    const companyRoles: RoleWithCounts[] = (roles ?? [])
      .filter((r) => r.company_id === c.id)
      .map((r) => {
        const roleApps = (applications ?? []).filter((a) => a.role_id === r.id)
        return {
          ...r,
          applicant_count: roleApps.length,
          hired_count: roleApps.filter((a) => a.status === 'hired').length,
        }
      })
    return { ...c, roles: companyRoles }
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">
          {companiesWithRoles.length} compan{companiesWithRoles.length !== 1 ? 'ies' : 'y'}
        </p>
        <AddCompanyButton />
      </div>

      {companiesWithRoles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
          <p className="text-sm text-zinc-400">No companies yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {companiesWithRoles.map((company) => (
            <CompanyAccordion key={company.id} company={company} />
          ))}
        </div>
      )}
    </div>
  )
}
