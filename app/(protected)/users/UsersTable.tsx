'use client'

import { useState } from 'react'
import { updateUserRole } from './actions'

type User = { email: string; role: string; name?: string | null }

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  lf: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
}

function Avatar({ email }: { email: string }) {
  const initials = email[0].toUpperCase()
  return (
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
      {initials}
    </div>
  )
}

export default function UsersTable({ users }: { users: User[] }) {
  const [editEmail, setEditEmail] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(user: User) {
    setEditEmail(user.email)
    setEditRole(user.role)
  }

  async function save() {
    if (!editEmail) return
    setSaving(true)
    await updateUserRole(editEmail, editRole)
    setEditEmail(null)
    setSaving(false)
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No users yet.</p>
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
                User
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Display name
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Role
              </th>
              <th className="px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((user) =>
              editEmail === user.email ? (
                <tr key={user.email} className="bg-zinc-50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar email={user.email} />
                      <span className="text-zinc-500">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-400">{user.name ?? '—'}</td>
                  <td className="px-6 py-3.5">
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="admin">admin</option>
                      <option value="lf">lf</option>
                    </select>
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={save}
                        disabled={saving}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditEmail(null)}
                        className="text-xs text-zinc-400 hover:text-zinc-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={user.email} className="hover:bg-zinc-50">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar email={user.email} />
                      <span className="font-medium text-zinc-900">{user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-500">{user.name ?? '—'}</td>
                  <td className="px-6 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        ROLE_BADGE[user.role] ?? 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <button
                      onClick={() => startEdit(user)}
                      className="text-xs text-zinc-400 hover:text-zinc-900"
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
