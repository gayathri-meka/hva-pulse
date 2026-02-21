import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import UserForm from './UserForm'
import UsersTable from './UsersTable'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function UsersPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const { error } = await searchParams

  const supabase = await createServerSupabaseClient()

  const [{ data: users }, { data: lfs }] = await Promise.all([
    supabase.from('users').select('email, role').order('role, email'),
    supabase.from('lfs').select('email, name'),
  ])

  const lfNameMap: Record<string, string> = {}
  for (const lf of lfs ?? []) {
    lfNameMap[lf.email] = lf.name
  }

  const enrichedUsers = (users ?? []).map((u) => ({
    email: u.email,
    role: u.role,
    name: u.role === 'lf' ? (lfNameMap[u.email] ?? null) : null,
  }))

  const adminCount = enrichedUsers.filter((u) => u.role === 'admin').length
  const lfCount = enrichedUsers.filter((u) => u.role === 'lf').length

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {adminCount} admin{adminCount !== 1 ? 's' : ''} · {lfCount} LF
          {lfCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">Add user</h2>
        <UserForm error={error} />
      </div>

      <UsersTable users={enrichedUsers} />
    </div>
  )
}
