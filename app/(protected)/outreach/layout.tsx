import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import OutreachNav from '@/components/outreach/OutreachNav'

export default async function OutreachLayout({ children }: { children: React.ReactNode }) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Job Outreach Engine</h1>
        <p className="mt-1 text-sm text-zinc-500">Define job personas and discover potential opportunities from job boards</p>
      </div>
      <div className="mb-6">
        <OutreachNav />
      </div>
      {children}
    </div>
  )
}
