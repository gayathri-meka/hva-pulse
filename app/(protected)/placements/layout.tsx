import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import PlacementsNav from '@/components/placements/PlacementsNav'

export default async function PlacementsLayout({ children }: { children: React.ReactNode }) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Placements</h1>
        <p className="mt-1 text-sm text-zinc-500">Manage companies, applications, and track hiring outcomes</p>
      </div>
      <div className="mb-6">
        <PlacementsNav />
      </div>
      {children}
    </div>
  )
}
