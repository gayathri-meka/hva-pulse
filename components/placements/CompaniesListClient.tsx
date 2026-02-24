'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CompanyAccordion from './CompanyAccordion'
import { reorderCompanies } from '@/app/(protected)/placements/actions'
import type { CompanyWithRoles } from '@/types'

function GripHandle({ attributes, listeners }: {
  attributes: ReturnType<typeof useSortable>['attributes']
  listeners:  ReturnType<typeof useSortable>['listeners']
}) {
  return (
    <div
      {...attributes}
      {...listeners}
      title="Drag to reorder"
      className="flex cursor-grab touch-none items-center rounded-lg border border-zinc-200 bg-white px-1.5 text-zinc-300 shadow-sm hover:text-zinc-400 active:cursor-grabbing"
    >
      <svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor">
        <circle cx="4" cy="4"  r="1.5" /><circle cx="10" cy="4"  r="1.5" />
        <circle cx="4" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" />
        <circle cx="4" cy="16" r="1.5" /><circle cx="10" cy="16" r="1.5" />
      </svg>
    </div>
  )
}

function SortableItem({
  company, isOpen, onToggle, showHandle,
}: {
  company:    CompanyWithRoles
  isOpen:     boolean
  onToggle:   () => void
  showHandle: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: company.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform:  CSS.Transform.toString(transform),
        transition,
        opacity:    isDragging ? 0.5 : 1,
        zIndex:     isDragging ? 10 : undefined,
      }}
      className="flex items-stretch gap-2"
    >
      {showHandle && (
        <GripHandle attributes={attributes} listeners={listeners} />
      )}
      <div className="min-w-0 flex-1">
        <CompanyAccordion company={company} isOpen={isOpen} onToggle={onToggle} />
      </div>
    </div>
  )
}

type RoleFilter = 'all' | 'open' | 'closed'

export default function CompaniesListClient({
  companies: initial,
}: {
  companies: CompanyWithRoles[]
}) {
  // orderedIds drives display order; initial is the source of truth for data
  const [orderedIds, setOrderedIds] = useState<string[]>(() => initial.map((c) => c.id))
  const [openIds, setOpenIds]       = useState<Set<string>>(() => new Set())
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')

  // Track which IDs we've already seen so we only auto-expand genuinely new companies,
  // not the ones present on the initial render.
  const seenIdsRef = useRef(new Set(initial.map((c) => c.id)))

  // Sync when server re-renders (new company added, role updated, etc.)
  useEffect(() => {
    const currentIds = new Set(initial.map((c) => c.id))
    // IDs not seen before this render are genuinely new
    const newIds = initial.map((c) => c.id).filter((id) => !seenIdsRef.current.has(id))
    seenIdsRef.current = currentIds

    setOrderedIds((prev) => {
      const prevSet  = new Set(prev)
      const filtered = prev.filter((id) => currentIds.has(id))
      const added    = initial.map((c) => c.id).filter((id) => !prevSet.has(id))
      return [...added, ...filtered]
    })

    // Auto-expand only genuinely new companies
    if (newIds.length > 0) {
      setOpenIds((prev) => {
        const next = new Set(prev)
        newIds.forEach((id) => next.add(id))
        return next
      })
    }
  }, [initial])

  // Derive ordered, fresh company data
  const allCompanies = orderedIds
    .map((id) => initial.find((c) => c.id === id))
    .filter((c): c is CompanyWithRoles => c != null)

  // Apply open/closed filter
  const companies =
    roleFilter === 'open'
      ? allCompanies.filter((c) => c.roles.some((r) => r.status === 'open'))
      : roleFilter === 'closed'
        ? allCompanies.filter((c) => c.roles.every((r) => r.status === 'closed') || c.roles.length === 0)
        : allCompanies

  const allOpen = openIds.size === companies.length

  function toggleAll() {
    setOpenIds(allOpen ? new Set() : new Set(companies.map((c) => c.id)))
  }

  const toggleOne = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOrderedIds((prev) => {
      const oldIndex  = prev.indexOf(active.id as string)
      const newIndex  = prev.indexOf(over.id as string)
      const reordered = arrayMove(prev, oldIndex, newIndex)
      reorderCompanies(reordered)
      return reordered
    })
  }

  // Hide drag handles when a filter is active (reordering a subset is misleading)
  const showHandles = allCompanies.length > 1 && roleFilter === 'all'

  return (
    <div>
      {/* Filter + Expand/Collapse row */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['all', 'open', 'closed'] as RoleFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setRoleFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                roleFilter === f
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {f === 'all' ? 'All' : f === 'open' ? 'Has Open Roles' : 'All Closed'}
            </button>
          ))}
        </div>
        <button
          onClick={toggleAll}
          className="text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
        >
          {allOpen ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={companies.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex flex-col gap-4">
            {companies.map((company) => (
              <SortableItem
                key={company.id}
                company={company}
                isOpen={openIds.has(company.id)}
                onToggle={() => toggleOne(company.id)}
                showHandle={showHandles}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}
