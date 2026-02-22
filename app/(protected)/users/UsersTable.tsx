'use client'

import { useState, useTransition } from 'react'
import { updateUser } from './actions'
import { useColumnResize } from '@/hooks/useColumnResize'

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

// Initial column widths: Name, Email, Role, Added, Actions
const INIT_WIDTHS = [220, 260, 110, 120, 100]

export default function UsersTable({ users }: { users: User[] }) {
  const [editId, setEditId]     = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { widths, onResizeStart } = useColumnResize(INIT_WIDTHS)

  function startEdit(user: User) {
    setEditId(user.id)
    setEditName(user.name ?? '')
    setEditEmail(user.email)
    setEditRole(user.role)
    setSaveError(null)
  }

  function cancelEdit() {
    setEditId(null)
    setSaveError(null)
  }

  function save() {
    if (!editId) return
    setSaveError(null)
    startTransition(async () => {
      const result = await updateUser(editId, { name: editName, email: editEmail, role: editRole })
      if (result.error) {
        setSaveError(result.error)
      } else {
        setEditId(null)
      }
    })
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-zinc-400">No users found.</p>
      </div>
    )
  }

  const inputCls = 'w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900'

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      {saveError && (
        <div className="border-b border-red-100 bg-red-50 px-6 py-2.5 text-sm text-red-600">
          {saveError}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm" style={{ tableLayout: 'fixed', width: widths.reduce((a, b) => a + b, 0) }}>
          <colgroup>
            {widths.map((w, i) => <col key={i} style={{ width: w }} />)}
          </colgroup>
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-left">
              {['Name', 'Email', 'Role', 'Added', ''].map((label, i) => (
                <th
                  key={i}
                  className="relative px-6 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400 select-none"
                  style={{ width: widths[i] }}
                >
                  {label}
                  {i < widths.length - 1 && (
                    <div
                      onMouseDown={(e) => onResizeStart(i, e)}
                      className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-zinc-300"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map((user) =>
              editId === user.id ? (
                <tr key={user.id} className="bg-zinc-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={editName || null} email={editEmail || user.email} />
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Full name"
                        className={inputCls}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className={inputCls}
                    />
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      <option value="admin">admin</option>
                      <option value="LF">LF</option>
                      <option value="learner">learner</option>
                    </select>
                  </td>
                  <td className="px-6 py-3 text-zinc-400">
                    {new Date(user.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={save}
                        disabled={isPending}
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                      >
                        {isPending ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
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
                      <span className="truncate font-medium text-zinc-900">{user.name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-zinc-500 truncate">{user.email}</td>
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
                    {new Date(user.created_at).toLocaleDateString('en-GB')}
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
