'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function CompaniesListClient({
  companies: initial,
}: {
  companies: CompanyWithRoles[]
}) {
  // orderedIds drives display order; initial is the source of truth for data
  const [orderedIds, setOrderedIds] = useState<string[]>(() => initial.map((c) => c.id))
  const [openIds, setOpenIds]       = useState<Set<string>>(
    () => new Set(initial.map((c) => c.id))
  )

  // Sync when server re-renders (new company added, role updated, etc.)
  useEffect(() => {
    setOrderedIds((prev) => {
      const currentIds = new Set(initial.map((c) => c.id))
      const prevSet    = new Set(prev)
      // Remove deleted, keep existing order
      const filtered = prev.filter((id) => currentIds.has(id))
      // Prepend new companies (they'll be at top per server sort_order)
      const newIds = initial.map((c) => c.id).filter((id) => !prevSet.has(id))
      return [...newIds, ...filtered]
    })
    // Auto-expand newly added companies
    setOpenIds((prev) => {
      const prevSet = new Set(prev)
      const newIds  = initial.map((c) => c.id).filter((id) => !prevSet.has(id))
      if (newIds.length === 0) return prev
      const next = new Set(prev)
      newIds.forEach((id) => next.add(id))
      return next
    })
  }, [initial])

  // Derive ordered, fresh company data
  const companies = orderedIds
    .map((id) => initial.find((c) => c.id === id))
    .filter((c): c is CompanyWithRoles => c != null)

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

  const showHandles = companies.length > 1

  return (
    <div>
      {/* Expand / Collapse all */}
      <div className="mb-3 flex justify-end">
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
