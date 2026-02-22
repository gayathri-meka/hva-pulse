'use client'

import { useState, useTransition } from 'react'
import { updateUserRole } from './actions'

type User = { id: string; email: string; name: string | null; role: string; created_at: string }

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  LF:      'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  learner: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initials = (name ?? email)[0].toUpperCase()
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
      {initials}
    </div>
  )
}

export default function UsersTable({ users }: { users: User[] }) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [isPending, startTransition] = useTransition()

  function startEdit(user: User) {
    setEditId(user.id)
    setEditRole(user.role)
  }

  function save() {
    if (!editId) return
    startTransition(async () => {
      await updateUserRole(editId, editRole)
      setEditId(null)
    })
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No users found.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Name
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Email
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Role
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Added
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((user) =>
              editId === user.id ? (
                <tr key={user.id} className="bg-zinc-50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} email={user.email} />
                      <span className="font-medium text-zinc-900">{user.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-500">{user.email}</td>
                  <td className="px-6 py-3.5">
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="admin">admin</option>
                      <option value="LF">LF</option>
                      <option value="learner">learner</option>
                    </select>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={save}
                        disabled={isPending}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="text-xs text-zinc-400 hover:text-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={user.id} className="hover:bg-zinc-50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} email={user.email} />
                      <span className="font-medium text-zinc-900">{user.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-500">{user.email}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        ROLE_BADGE[user.role] ?? 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => startEdit(user)}
                      className="text-xs text-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
