import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import ApplyForm from '@/components/learner/ApplyForm'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoleDetailPage({ params }: Props) {
  const { id } = await params

  const appUser = await getAppUser()
  if (!appUser) redirect('/login')

  const supabase = await createServerSupabaseClient()

  const [{ data: role }, { data: application }, { data: resumes }] = await Promise.all([
    supabase
      .from('roles')
      .select('id, role_title, location, salary_range, job_description, jd_attachment_url, status, company_id, companies(company_name)')
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
  const companyName = company?.company_name ?? ''

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      {/* Back */}
      <Link
        href="/learner"
        className="mb-5 inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to roles
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">{companyName}</h1>
        <p className="mt-1 text-base font-medium text-zinc-500">{role.role_title}</p>

        {/* Location + Salary */}
        <div className="mt-3 flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5 text-base font-semibold text-zinc-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
              <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
            </svg>
            {role.location}
          </span>

          {role.salary_range && (
            <span className="flex items-center gap-1.5 text-base font-semibold text-zinc-800">
              <span className="shrink-0 font-medium text-zinc-400">₹</span>
              {role.salary_range}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="mt-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              role.status === 'open'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {role.status === 'open' ? 'Open for applications' : 'Closed'}
          </span>
        </div>
      </div>

      {/* Job Description */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-400">
            Job Description
          </h2>
          {role.jd_attachment_url && (
            <a
              href={role.jd_attachment_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
                <path fillRule="evenodd" d="M4 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6.414A2 2 0 0 0 13.414 5L11 2.586A2 2 0 0 0 9.586 2H4Zm5 1.5v2A1.5 1.5 0 0 0 10.5 7H13v5a.5.5 0 0 1-.5.5h-9A.5.5 0 0 1 3 12V4a.5.5 0 0 1 .5-.5h5Z" clipRule="evenodd" />
              </svg>
              Download JD
            </a>
          )}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
          {role.job_description}
        </p>
      </div>

      {/* Apply section */}
      <div className="mt-4">
        <ApplyForm
          roleId={role.id}
          roleStatus={role.status as 'open' | 'closed'}
          location={role.location}
          salaryRange={role.salary_range as string | null}
          application={application ?? null}
          resumes={resumes ?? []}
        />
      </div>
    </div>
  )
}
