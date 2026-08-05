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
import Tooltip from '@/components/ui/Tooltip'
import { spocName, type TicketCategory, type SpocUser } from '@/lib/tickets'
import { saveCategory, deleteCategory, reorderCategories } from './settings-actions'

// A CSS-grid layout (not a <table>) so dnd-kit's injected accessibility <div>s are valid children.
const GRID = 'grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)_80px_128px] items-center'

const GripIcon = (
  <svg width="12" height="16" viewBox="0 0 14 20" fill="currentColor">
    <circle cx="4" cy="4" r="1.5" /><circle cx="10" cy="4" r="1.5" />
    <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" />
    <circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" />
  </svg>
)

const PencilIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931z" />
  </svg>
)

const TrashIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
  </svg>
)

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
  // Render the drag-and-drop tree only after mount — SSR + first client render show a plain list
  // (no dnd-kit ids), so there's no hydration mismatch.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

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

  const rowProps = (c: TicketCategory, i: number) => ({
    category: c, position: i + 1, spocs,
    onEdit: () => setEditCat(c), onDelete: () => setDeleteCat(c),
  })

  return (
    <div className="space-y-8">
      {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {/* Categories */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">Categories</h2>
          <button onClick={() => setEditCat('new')} className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95">Add category</button>
        </div>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white text-sm">
          <div className={`${GRID} bg-zinc-50 text-xs font-medium text-zinc-500`}>
            <span className="px-4 py-2">#</span>
            <span className="px-4 py-2">Name</span>
            <span className="px-4 py-2">SPOCs</span>
            <span className="px-4 py-2">Active</span>
            <span className="px-4 py-2" />
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-zinc-400">No categories.</div>
          ) : mounted ? (
            <DndContext id="ticket-categories-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {items.map((c, i) => <SortableCategoryRow key={c.id} {...rowProps(c, i)} />)}
              </SortableContext>
            </DndContext>
          ) : (
            items.map((c, i) => <PlainCategoryRow key={c.id} {...rowProps(c, i)} />)
          )}
        </div>
        <p className="mt-2 text-xs text-zinc-400">Drag the <span className="align-middle">⋮⋮</span> handle to reorder.</p>
      </section>

      <p className="text-xs text-zinc-400">
        SPOCs are the <span className="font-medium">admin &amp; staff</span> users - pick them per category when adding/editing above.
        Manage them on the <a href="/users" className="text-[#5BAE5B] hover:underline">Users</a> page; the Slack handle for @tagging is matched automatically by email.
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

type RowProps = {
  category: TicketCategory
  position: number
  spocs: SpocUser[]
  onEdit: () => void
  onDelete: () => void
}

// The visual cells, shared by the plain (pre-mount) and sortable rows.
function CategoryCells({ category, position, spocs, onEdit, onDelete, handle }: RowProps & { handle: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 text-zinc-400">
        {handle}
        <span className="tabular-nums">{position}</span>
      </div>
      <div className="truncate px-4 py-2 font-medium text-zinc-800">{category.name}</div>
      <div className="min-w-0 px-4 py-2 text-zinc-600">
        {(() => {
          const list = (category.spoc_emails || []).map((e) => spocName(e, spocs)).join(', ') || '—'
          return <Tooltip content={list} truncate>{list}</Tooltip>
        })()}
      </div>
      <div className="px-4 py-2">{category.active ? <span className="text-emerald-600">Yes</span> : <span className="text-zinc-400">No</span>}</div>
      <div className="flex items-center justify-end gap-1 px-4 py-2">
        <Tooltip content="Edit">
          <button onClick={onEdit} aria-label="Edit" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">{PencilIcon}</button>
        </Tooltip>
        <Tooltip content="Delete">
          <button onClick={onDelete} aria-label="Delete" className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">{TrashIcon}</button>
        </Tooltip>
      </div>
    </>
  )
}

function PlainCategoryRow(props: RowProps) {
  return (
    <div className={`${GRID} border-t border-zinc-100`}>
      <CategoryCells {...props} handle={<span className="text-zinc-300">{GripIcon}</span>} />
    </div>
  )
}

function SortableCategoryRow(props: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.category.id })
  const handle = (
    <button {...attributes} {...listeners} title="Drag to reorder" className="cursor-grab touch-none rounded p-0.5 text-zinc-300 hover:text-zinc-500 active:cursor-grabbing">
      {GripIcon}
    </button>
  )
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1, zIndex: isDragging ? 10 : undefined }}
      className={`${GRID} border-t border-zinc-100 ${isDragging ? 'bg-zinc-50' : 'bg-white'}`}
    >
      <CategoryCells {...props} handle={handle} />
    </div>
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
          {!category && <span className="mt-1 block text-xs text-zinc-400">New categories are added at the end — drag the handle in the list to reorder.</span>}
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
