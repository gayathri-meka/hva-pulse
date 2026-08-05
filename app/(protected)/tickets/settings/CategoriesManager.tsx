'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Modal from '@/components/placements/Modal'
import { spocName, type TicketCategory, type SpocUser } from '@/lib/tickets'
import { saveCategory, deleteCategory, reorderCategories } from './settings-actions'

export default function CategoriesManager({ categories, spocs }: {
  categories: TicketCategory[]
  spocs: SpocUser[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editCat, setEditCat] = useState<TicketCategory | 'new' | null>(null)
  const [deleteCat, setDeleteCat] = useState<TicketCategory | null>(null)
  // Local order for optimistic drag-and-drop; re-synced when the server data changes.
  const [items, setItems] = useState<TicketCategory[]>(categories)
  useEffect(() => { setItems(categories) }, [categories])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

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

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((c) => c.id === active.id)
    const newIndex = items.findIndex((c) => c.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered) // optimistic
    run(() => reorderCategories(reordered.map((c) => c.id)))
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <tbody className="divide-y divide-zinc-100">
                  {items.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-zinc-400">No categories.</td></tr>}
                  {items.map((c, i) => (
                    <SortableCategoryRow key={c.id} category={c} position={i + 1} spocs={spocs}
                      onEdit={() => setEditCat(c)} onDelete={() => setDeleteCat(c)} />
                  ))}
                </tbody>
              </SortableContext>
            </DndContext>
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

function SortableCategoryRow({ category, position, spocs, onEdit, onDelete }: {
  category: TicketCategory
  position: number
  spocs: SpocUser[]
  onEdit: () => void
  onDelete: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id })
  return (
    <tr ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }} className={isDragging ? 'bg-zinc-50' : ''}>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2 text-zinc-400">
          <button {...attributes} {...listeners} title="Drag to reorder" className="cursor-grab touch-none rounded p-0.5 text-zinc-300 hover:text-zinc-500 active:cursor-grabbing">
            <svg width="12" height="16" viewBox="0 0 14 20" fill="currentColor">
              <circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" />
              <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" />
              <circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" />
            </svg>
          </button>
          <span className="tabular-nums">{position}</span>
        </div>
      </td>
      <td className="px-4 py-2 font-medium text-zinc-800">{category.name}</td>
      <td className="px-4 py-2 text-zinc-600">{(category.spoc_emails || []).map((e) => spocName(e, spocs)).join(', ') || '—'}</td>
      <td className="px-4 py-2">{category.active ? <span className="text-emerald-600">Yes</span> : <span className="text-zinc-400">No</span>}</td>
      <td className="px-4 py-2 text-right">
        <button onClick={onEdit} className="mr-2 text-xs text-zinc-500 hover:text-zinc-800">Edit</button>
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">Delete</button>
      </td>
    </tr>
  )
}

function CategoryModal({ category, spocs, pending, onClose, onSave }: {
  category: TicketCategory | null
  spocs: SpocUser[]
  pending: boolean
  onClose: () => void
  onSave: (input: { id?: string; name: string; spoc_emails: string[]; active: boolean }) => void
}) {
  const [name, setName] = useState(category?.name ?? '')
  const [active, setActive] = useState(category?.active ?? true)
  const [spocEmails, setSpocEmails] = useState<string[]>(category?.spoc_emails ?? [])

  const has = (email: string) => spocEmails.some((e) => e.toLowerCase() === email.toLowerCase())
  const toggle = (email: string) => setSpocEmails((cur) => (has(email) ? cur.filter((e) => e.toLowerCase() !== email.toLowerCase()) : [...cur, email]))

  return (
    <Modal title={category ? `Edit · ${category.name}` : 'Add category'} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" />
          {!category && <span className="mt-1 block text-xs text-zinc-400">New categories are added at the end — reorder with the ▲▼ arrows in the list.</span>}
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
          <button disabled={pending || !name.trim()} onClick={() => onSave({ id: category?.id, name, spoc_emails: spocEmails, active })}
            className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50">
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
