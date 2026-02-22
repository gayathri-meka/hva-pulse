'use client'

import { addUser } from './actions'

export default function UserForm({ error }: { error?: string }) {
  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          {error}
        </div>
      )}
      <form action={addUser} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Name</label>
          <input
            name="name"
            type="text"
            placeholder="Full name"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Email</label>
          <input
            name="email"
            type="email"
            placeholder="name@example.com"
            required
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-500">Role</label>
          <select
            name="role"
            defaultValue="admin"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
          >
            <option value="admin">Admin</option>
            <option value="LF">LF</option>
            <option value="learner">Learner</option>
          </select>
        </div>

        <button
          type="submit"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Add user
        </button>
      </form>
    </div>
  )
}
