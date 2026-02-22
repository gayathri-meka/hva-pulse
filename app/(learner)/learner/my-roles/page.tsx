import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import MyRolesList from '@/components/learner/MyRolesList'

export const dynamic = 'force-dynamic'

export default async function MyRolesPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const { data: rawApplications } = await supabase
    .from('applications')
    .select(
      'id, role_id, status, resume_url, created_at, roles(role_title, location, salary_range, companies(company_name))',
    )
    .eq('user_id', appUser.id)
    .order('created_at', { ascending: false })

  type RawApp = {
    id: string
    role_id: string
    status: string
    resume_url: string | null
    created_at: string
    roles: {
      role_title: string
      location: string
      salary_range: string | null
      companies: { company_name: string } | null
    } | null
  }

  const applications = ((rawApplications ?? []) as unknown as RawApp[]).map((a) => ({
    id: a.id,
    role_id: a.role_id,
    status: a.status,
    created_at: a.created_at,
    role_title: a.roles?.role_title ?? 'Unknown Role',
    location: a.roles?.location ?? '',
    salary_range: a.roles?.salary_range ?? null,
    company_name: a.roles?.companies?.company_name ?? 'Unknown Company',
  }))

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">My Roles</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          {applications.length} application{applications.length !== 1 ? 's' : ''}
        </p>
      </div>
      <MyRolesList applications={applications} />
    </div>
  )
}
