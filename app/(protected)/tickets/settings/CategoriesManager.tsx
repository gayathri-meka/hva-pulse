'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/placements/Modal'
import { spocName, type TicketCategory, type SpocUser } from '@/lib/tickets'
import { saveCategory, deleteCategory } from './settings-actions'

export default function CategoriesManager({ categories, spocs }: {
  categories: TicketCategory[]
  spocs: SpocUser[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editCat, setEditCat] = useState<TicketCategory | 'new' | null>(null)
  const [deleteCat, setDeleteCat] = useState<TicketCategory | null>(null)

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError(null)
    setSaving(true)
    try {
      const res = await fn()
      if (!res.ok) { setError(res.error || 'Something went wrong.'); return }
      onDone?.()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Categories */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">Categories</h2>
          <button onClick={() => setEditCat('new')} className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95">Add category</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">SPOCs</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">No categories.</td></tr>}
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-zinc-400">{c.sort_order}</td>
                  <td className="px-4 py-2 font-medium text-zinc-800">{c.name}</td>
                  <td className="px-4 py-2 text-zinc-600">{(c.spoc_emails || []).map((e) => spocName(e, spocs)).join(', ') || '—'}</td>
                  <td className="px-4 py-2">{c.active ? <span className="text-emerald-600">Yes</span> : <span className="text-zinc-400">No</span>}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditCat(c)} className="mr-2 text-xs text-zinc-500 hover:text-zinc-800">Edit</button>
                    <button onClick={() => setDeleteCat(c)} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-zinc-400">
        SPOCs are your <span className="font-medium">admin &amp; staff</span> users - pick them per category when adding/editing above.
        Manage the people on the <a href="/users" className="text-[#5BAE5B] hover:underline">Users</a> page; their Slack handle for @-tagging is matched automatically by email.
      </p>

      {editCat && (
        <CategoryModal
          category={editCat === 'new' ? null : editCat}
          spocs={spocs}
          nextSortOrder={categories.reduce((m, c) => Math.max(m, c.sort_order), 0) + 1}
          takenSortOrders={categories.filter((c) => editCat === 'new' || c.id !== editCat.id).map((c) => c.sort_order)}
          pending={saving}
          onClose={() => setEditCat(null)}
          onSave={(input) => run(() => saveCategory(input), () => setEditCat(null))}
        />
      )}

      {deleteCat && (
        <Modal title="Delete category?" onClose={() => setDeleteCat(null)}>
          <p className="text-sm text-zinc-600">
            Remove <span className="font-medium">“{deleteCat.name}”</span> from the category list? Existing tickets keep their category; it just won&apos;t be offered on new tickets.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setDeleteCat(null)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button disabled={saving} onClick={() => run(() => deleteCategory(deleteCat.id), () => setDeleteCat(null))}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function CategoryModal({ category, spocs, nextSortOrder, takenSortOrders, pending, onClose, onSave }: {
  category: TicketCategory | null
  spocs: SpocUser[]
  nextSortOrder: number
  takenSortOrders: number[]
  pending: boolean
  onClose: () => void
  onSave: (input: { id?: string; name: string; spoc_emails: string[]; sort_order: number; active: boolean }) => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  // New categories default to the next slot (max existing + 1), not 0, so they land at the end.
  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? nextSortOrder)
  const [active, setActive] = useState(category?.active ?? true)
  const [spocEmails, setSpocEmails] = useState<string[]>(category?.spoc_emails ?? [])

  const has = (email: string) => spocEmails.some((e) => e.toLowerCase() === email.toLowerCase())
  const toggle = (email: string) => setSpocEmails((cur) => (has(email) ? cur.filter((e) => e.toLowerCase() !== email.toLowerCase()) : [...cur, email]))

  const duplicateOrder = takenSortOrders.includes(sortOrder)
  const canSave = !!name.trim() && !duplicateOrder

  return (
    <Modal title={category ? `Edit · ${category.name}` : 'Add category'} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Sort order</span>
          {/* type=number for numeric-only input; spinners hidden (number only, type to change). */}
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className={`w-28 rounded-lg border px-3 py-2 text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${duplicateOrder ? 'border-red-300 focus:border-red-400' : 'border-zinc-200'}`}
          />
          {duplicateOrder && <span className="mt-1 block text-xs text-red-600">Sort order {sortOrder} is already used by another category. Pick a different number.</span>}
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">SPOCs (admin/staff users)</span>
          <div className="flex flex-wrap gap-1.5">
            {spocs.map((s) => (
              <button key={s.id} onClick={() => toggle(s.email)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${has(s.email) ? 'bg-[#5BAE5B] text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
                {s.name || s.email}
              </button>
            ))}
            {spocs.length === 0 && <span className="text-xs text-zinc-400">No admin/staff users to assign.</span>}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-zinc-300" />
          Active (shown in the Slack form)
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
          <button disabled={pending || !canSave} onClick={() => onSave({ id: category?.id, name, spoc_emails: spocEmails, sort_order: sortOrder, active })}
            className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
