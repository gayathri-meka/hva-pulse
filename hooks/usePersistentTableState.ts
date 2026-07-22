'use client'

import { useEffect, useState } from 'react'
import type { ColumnFiltersState, OnChangeFn, SortingState } from '@tanstack/react-table'

type StoredTableState = {
  sorting: SortingState
  columnFilters: ColumnFiltersState
  search: string
}

function readState(key: string): Partial<StoredTableState> {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(key) ?? '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function isSortingState(value: unknown): value is SortingState {
  return Array.isArray(value) && value.every((item) =>
    item != null && typeof item === 'object'
      && typeof (item as { id?: unknown }).id === 'string'
      && typeof (item as { desc?: unknown }).desc === 'boolean')
}

function isColumnFiltersState(value: unknown): value is ColumnFiltersState {
  return Array.isArray(value) && value.every((item) =>
    item != null && typeof item === 'object'
      && typeof (item as { id?: unknown }).id === 'string'
      && 'value' in item)
}

export function usePersistentTableState(
  key: string,
  initialSorting: SortingState,
  initialColumnFilters: ColumnFiltersState = [],
) {
  const storageKey = `hva-pulse:table-state:${key}`
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialColumnFilters)
  const [search, setSearch] = useState('')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = readState(storageKey)
    if (isSortingState(stored.sorting)) setSorting(stored.sorting)
    if (isColumnFiltersState(stored.columnFilters)) setColumnFilters(stored.columnFilters)
    if (typeof stored.search === 'string') setSearch(stored.search)
    setHydrated(true)
  }, [storageKey])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ sorting, columnFilters, search }))
    } catch {
      // Table interaction must keep working when browser storage is unavailable.
    }
  }, [hydrated, storageKey, sorting, columnFilters, search])

  const onSortingChange: OnChangeFn<SortingState> = (updater) =>
    setSorting((current) => typeof updater === 'function' ? updater(current) : updater)

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = (updater) =>
    setColumnFilters((current) => typeof updater === 'function' ? updater(current) : updater)

  return { sorting, columnFilters, search, onSortingChange, onColumnFiltersChange, setSearch }
}
