'use client'

import { useState } from 'react'
import { updateLF } from './actions'

type LF = { id: number; name: string; email: string }

export default function LFsTable({ lfs }: { lfs: LF[] }) {
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saving, setSaving] = useState(false)

  function startEdit(lf: LF) {
    setEditId(lf.id)
    setEditName(lf.name)
    setEditEmail(lf.email)
  }

  async function save() {
    if (!editId) return
    setSaving(true)
    await updateLF(editId, editName.trim(), editEmail.trim())
    setEditId(null)
    setSaving(false)
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-gray-500">
          <th className="pb-3 pr-6 font-medium">Name</th>
          <th className="pb-3 pr-6 font-medium">Email</th>
          <th className="pb-3 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {lfs.map((lf) =>
          editId === lf.id ? (
            <tr key={lf.id} className="border-b">
              <td className="py-2 pr-6">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </td>
              <td className="py-2 pr-6">
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded border px-2 py-1 text-sm"
                />
              </td>
              <td className="py-2">
                <div className="flex gap-3">
                  <button
                    onClick={save}
                    disabled={saving}
                    className="text-sm underline underline-offset-2 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="text-sm text-gray-400 underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            <tr key={lf.id} className="border-b hover:bg-gray-50">
              <td className="py-3 pr-6">{lf.name}</td>
              <td className="py-3 pr-6 text-gray-500">{lf.email}</td>
              <td className="py-3">
                <button
                  onClick={() => startEdit(lf)}
                  className="text-sm text-gray-400 underline underline-offset-2 hover:text-black"
                >
                  Edit
                </button>
              </td>
            </tr>
          )
        )}
        {lfs.length === 0 && (
          <tr>
            <td colSpan={3} className="py-8 text-center text-gray-400">
              No LFs yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  )
}
