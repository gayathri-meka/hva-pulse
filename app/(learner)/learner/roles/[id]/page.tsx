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
      .select('id, status, resume_url, created_at, not_shortlisted_reason, rejection_feedback')
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

      {/* Application status — shown above JD when the learner has already applied */}
      {application && (
        <div className="mt-4">
          <ApplyForm
            roleId={role.id}
            roleStatus={role.status as 'open' | 'closed'}
            location={role.location}
            salaryRange={role.salary_range as string | null}
            application={application}
            resumes={resumes ?? []}
          />
        </div>
      )}

      {/* Job Description */}
      <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-400">
          Job Description
        </h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
          {role.job_description}
        </p>
      </div>

      {/* JD attachment card */}
      {role.jd_attachment_url && (
        <a
          href={role.jd_attachment_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-900">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-white">
              <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 1 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-900">Full Job Description (PDF)</p>
            <p className="mt-0.5 text-xs text-zinc-500">Read this before applying — tap to open</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-zinc-400">
            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
          </svg>
        </a>
      )}

      {/* Apply form — only shown when the learner hasn't applied yet */}
      {!application && (
        <div className="mt-4">
          <ApplyForm
            roleId={role.id}
            roleStatus={role.status as 'open' | 'closed'}
            location={role.location}
            salaryRange={role.salary_range as string | null}
            application={null}
            resumes={resumes ?? []}
          />
        </div>
      )}
    </div>
  )
}
