import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import RoleDetailTabs from '@/components/learner/RoleDetailTabs'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function RoleDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { tab } = await searchParams

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const [{ data: role }, { data: application }, { data: resumes }] = await Promise.all([
    supabase
      .from('roles')
      .select('id, role_title, location, salary_range, job_description, status, company_id, companies(company_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('applications')
      .select('id, status, resume_url, created_at')
      .eq('role_id', id)
      .eq('user_id', appUser.id)
      .maybeSingle(),
    supabase
      .from('resumes')
      .select('id, version_name, file_url, created_at')
      .eq('user_id', appUser.id)
      .order('created_at', { ascending: false }),
  ])

  if (!role) notFound()

  type Companies = { company_name: string } | null
  const company = role.companies as unknown as Companies

  const initialTab =
    tab === 'apply' ? 'apply' : tab === 'jd' ? 'jd' : 'overview'

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link
        href="/learner"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back
      </Link>

      <div className="mb-1">
        <p className="text-xs font-medium text-zinc-500">{company?.company_name}</p>
        <h1 className="text-xl font-bold text-zinc-900">{role.role_title}</h1>
        <p className="mt-0.5 text-sm text-zinc-400">
          {role.location}
          {role.salary_range ? ` · ${role.salary_range}` : ''}
        </p>
      </div>

      <RoleDetailTabs
        role={{
          id: role.id,
          role_title: role.role_title,
          location: role.location,
          salary_range: role.salary_range as string | null,
          job_description: role.job_description,
          status: role.status as 'open' | 'closed',
          company_name: company?.company_name ?? '',
        }}
        application={
          application
            ? {
                id: application.id,
                status: application.status,
                resume_url: application.resume_url,
                created_at: application.created_at,
              }
            : null
        }
        resumes={resumes ?? []}
        initialTab={initialTab as 'overview' | 'jd' | 'apply'}
      />
    </div>
  )
}
