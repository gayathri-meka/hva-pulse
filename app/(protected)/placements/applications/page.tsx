import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import CompanyFilter from '@/components/placements/CompanyFilter'
import ApplicationsList from '@/components/placements/ApplicationsList'
import type { ApplicationWithLearner } from '@/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ company?: string; role?: string }>
}

export default async function ApplicationsPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const { company: companyFilter, role: roleFilter } = await searchParams

  const supabase = await createServerSupabaseClient()

  const [{ data: companies }, { data: roles }, { data: rawApplications }, { data: rawLearners }] =
    await Promise.all([
      supabase.from('companies').select('id, company_name, created_at').order('company_name'),
      supabase.from('roles').select('id, company_id, role_title, location'),
      supabase.from('applications').select('*').order('created_at', { ascending: false }),
      // Join learners with users to get name and email
      supabase.from('learners').select('learner_id, users!learners_user_id_fkey(name, email)'),
    ])

  // Build lookup maps
  const learnerMap = Object.fromEntries(
    (rawLearners ?? []).map((l: Record<string, unknown>) => {
      const u = l.users as { name: string; email: string } | null
      return [l.learner_id, { name: u?.name ?? 'Unknown', email: u?.email ?? '' }]
    })
  )
  const roleMap = Object.fromEntries(
    (roles ?? []).map((r) => [r.id, r])
  )
  const companyMap = Object.fromEntries(
    (companies ?? []).map((c) => [c.id, c.company_name])
  )

  // Determine which role_ids to include
  let allowedRoleIds: Set<string> | null = null
  if (roleFilter) {
    allowedRoleIds = new Set([roleFilter])
  } else if (companyFilter) {
    const matchingRoleIds = (roles ?? [])
      .filter((r) => r.company_id === companyFilter)
      .map((r) => r.id)
    allowedRoleIds = new Set(matchingRoleIds)
  }

  const filteredApplications = allowedRoleIds
    ? (rawApplications ?? []).filter((a) => allowedRoleIds!.has(a.role_id))
    : (rawApplications ?? [])

  const applications: ApplicationWithLearner[] = filteredApplications.map((a) => {
    const role = roleMap[a.role_id]
    return {
      id: a.id,
      role_id: a.role_id,
      learner_id: a.learner_id,
      user_id: a.user_id ?? null,
      status: a.status,
      resume_url: a.resume_url,
      created_at: a.created_at,
      updated_at: a.updated_at,
      learner_name: learnerMap[a.learner_id]?.name ?? 'Unknown',
      learner_email: learnerMap[a.learner_id]?.email ?? '',
      company_name: companyMap[role?.company_id ?? ''] ?? 'Unknown',
      role_title: role?.role_title ?? 'Unknown',
      location: role?.location ?? '',
    }
  })

  return (
    <div>
      <div className="mb-5">
        <Suspense>
          <CompanyFilter companies={companies ?? []} />
        </Suspense>
      </div>
      <ApplicationsList applications={applications} />
    </div>
  )
}
