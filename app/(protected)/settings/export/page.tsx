import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const EXPORTS = [
  {
    table:       'alumni',
    name:        'Alumni',
    description: 'All alumni records with their current job (company, role, salary, placement month).',
  },
  {
    table:       'applications',
    name:        'Applications',
    description: 'Full placement pipeline — all applications with learner, company, role, status, feedback and timestamps.',
  },
  {
    table:       'companies',
    name:        'Companies',
    description: 'All companies in the placement pipeline.',
  },
  {
    table:       'roles',
    name:        'Roles',
    description: 'All roles with location, salary range, status and job description.',
  },
]

export default async function ExportPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Export</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Download a CSV snapshot of your data. Files are named with today&apos;s date.
        </p>
      </div>

      <div className="grid gap-4">
        {EXPORTS.map(({ table, name, description }) => (
          <div key={table} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-zinc-400">
                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm4.75 6.75a.75.75 0 0 1 1.5 0v2.546l.943-1.048a.75.75 0 1 1 1.114 1.004l-2.25 2.5a.75.75 0 0 1-1.114 0l-2.25-2.5a.75.75 0 1 1 1.114-1.004l.943 1.048V8.75Z" clipRule="evenodd" />
                  </svg>
                  <h2 className="text-base font-semibold text-zinc-900">{name}</h2>
                </div>
                <p className="mt-1 text-sm text-zinc-500">{description}</p>
              </div>
              <a
                href={`/api/export?table=${table}`}
                download
                className="shrink-0 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
              >
                Download CSV
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
