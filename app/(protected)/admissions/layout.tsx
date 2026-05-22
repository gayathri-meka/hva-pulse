import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import AdmissionsNav from '@/components/admissions/AdmissionsNav'

export default async function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'staff') redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Admissions</h1>
        <p className="mt-1 text-sm text-zinc-500">Applications and onboarding for prospective learners</p>
      </div>
      <div className="mb-6">
        <AdmissionsNav />
      </div>
      {children}
    </div>
  )
}
