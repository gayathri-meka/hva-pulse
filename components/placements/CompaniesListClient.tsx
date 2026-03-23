'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
import RolesTable from './RolesTable'
import { reorderCompanies } from '@/app/(protected)/placements/actions'
import type { CompanyWithRoles } from '@/types'

type ViewMode = 'cards' | 'table'

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
  initialView = 'cards',
}: {
  companies: CompanyWithRoles[]
  initialView?: ViewMode
}) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [view, setView] = useState<ViewMode>(initialView)

  function switchView(v: ViewMode) {
    setView(v)
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    if (v === 'cards') params.delete('week')
    router.push(`?${params.toString()}`)
  }

  // orderedIds drives display order; initial is the source of truth for data
  const [orderedIds, setOrderedIds] = useState<string[]>(() => initial.map((c) => c.id))
  const [openIds, setOpenIds]       = useState<Set<string>>(() => new Set(initial.map((c) => c.id)))
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [search, setSearch]         = useState('')

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

  // Apply open/closed filter then search
  const searchTerm = search.trim().toLowerCase()
  const companies = allCompanies
    .filter((c) =>
      roleFilter === 'open'   ? c.roles.some((r) => r.status === 'open') :
      roleFilter === 'closed' ? (c.roles.every((r) => r.status === 'closed') || c.roles.length === 0) :
      true
    )
    .filter((c) => !searchTerm || c.company_name.toLowerCase().includes(searchTerm))

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
      {/* View toggle + Filter + Search + Expand/Collapse row */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* Cards / Table toggle */}
        <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5">
          {(['cards', 'table'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                view === v ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              {v === 'cards' ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path d="M2 4.75A2.75 2.75 0 0 1 4.75 2h10.5A2.75 2.75 0 0 1 18 4.75v10.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25V4.75Zm2.75-.75c-.69 0-1.25.56-1.25 1.25v.5h11v-.5c0-.69-.56-1.25-1.25-1.25H4.75ZM3.5 7.25v8c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-8h-13Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M.99 5.24A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25l.01 9.5A2.25 2.25 0 0 1 16.76 17H3.26A2.267 2.267 0 0 1 1 14.74l-.01-9.5Zm8.26 9.52v-.625a.75.75 0 0 0-1.5 0v.625h1.5Zm1.5 0h1.5v-.625a.75.75 0 0 0-1.5 0v.625Zm3 0h1.5v-.625a.75.75 0 0 0-1.5 0v.625Zm-9 0h1.5v-.625a.75.75 0 0 0-1.5 0v.625ZM2.5 9.5v1.5h15V9.5h-15Zm0-2h15V6a.75.75 0 0 0-.75-.75H3.25A.75.75 0 0 0 2.5 6v1.5Z" clipRule="evenodd" />
                </svg>
              )}
              {v === 'cards' ? 'Cards' : 'Table'}
            </button>
          ))}
        </div>

        {view === 'cards' && (
          <>
            {/* Status pills */}
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

            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400"
              >
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search companies…"
                className="w-full rounded-full border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs text-zinc-700 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-1"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              )}
            </div>

            <button
              onClick={toggleAll}
              className="ml-auto text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700"
            >
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
          </>
        )}
      </div>

      {view === 'table' ? (
        <RolesTable companies={initial} />
      ) : (
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
      )}
    </div>
  )
}
