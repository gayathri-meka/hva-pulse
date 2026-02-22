import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import MyRolesList from '@/components/learner/MyRolesList'

export const dynamic = 'force-dynamic'

export default async function MyRolesPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const [{ data: rawApplications }, { data: rawPreferences }] = await Promise.all([
    supabase
      .from('applications')
      .select(
        'id, role_id, status, resume_url, created_at, roles(role_title, location, salary_range, companies(company_name))',
      )
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('role_preferences')
      .select('id, role_id, created_at, roles(role_title, location, salary_range, companies(company_name))')
      .eq('user_id', appUser.id)
      .eq('preference', 'not_interested')
      .order('created_at', { ascending: false }),
  ])

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

  type RawPref = {
    id: string
    role_id: string
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

  const notInterested = ((rawPreferences ?? []) as unknown as RawPref[]).map((p) => ({
    id: p.id,
    role_id: p.role_id,
    status: 'not_interested',
    created_at: p.created_at,
    role_title: p.roles?.role_title ?? 'Unknown Role',
    location: p.roles?.location ?? '',
    salary_range: p.roles?.salary_range ?? null,
    company_name: p.roles?.companies?.company_name ?? 'Unknown Company',
  }))

  const firstName = appUser.name?.split(' ')[0] ?? appUser.email.split('@')[0]
  const appCount = applications.length

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-zinc-900">
          {firstName}&apos;s {appCount} Application{appCount !== 1 ? 's' : ''}
        </h1>
      </div>
      <MyRolesList applications={[...applications, ...notInterested]} />
    </div>
  )
}
