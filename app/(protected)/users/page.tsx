import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import UserForm from './UserForm'
import UsersTable from './UsersTable'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ role?: string; error?: string }>
}

export default async function UsersPage({ searchParams }: Props) {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin') redirect('/dashboard')

  const { role: roleFilter, error } = await searchParams

  const supabase = await createServerSupabaseClient()

  const { data: allUsers } = await supabase
    .from('users')
    .select('id, email, name, role, created_at')
    .order('created_at', { ascending: false })

  const users = (allUsers ?? []) as {
    id: string; email: string; name: string | null; role: string; created_at: string
  }[]

  const adminCount   = users.filter((u) => u.role === 'admin').length
  const lfCount      = users.filter((u) => u.role === 'LF').length
  const learnerCount = users.filter((u) => u.role === 'learner').length

  const filtered = roleFilter ? users.filter((u) => u.role === roleFilter) : users

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {adminCount} admin{adminCount !== 1 ? 's' : ''} · {lfCount} LF{lfCount !== 1 ? 's' : ''} · {learnerCount} learner{learnerCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Role filter tabs */}
      <div className="mb-6 flex gap-1 border-b border-zinc-200">
        {[
          { label: 'All', value: '' },
          { label: 'Admin', value: 'admin' },
          { label: 'LF', value: 'LF' },
          { label: 'Learner', value: 'learner' },
        ].map(({ label, value }) => (
          <a
            key={value}
            href={value ? `/users?role=${value}` : '/users'}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
              (roleFilter ?? '') === value
                ? 'text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {label}
            {(roleFilter ?? '') === value && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#5BAE5B]" />
            )}
          </a>
        ))}
      </div>

      {/* Add user form */}
      <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-zinc-700">Add user</h2>
        <UserForm error={error} />
      </div>

      <UsersTable users={filtered} currentUserId={appUser.id} />
    </div>
  )
}
