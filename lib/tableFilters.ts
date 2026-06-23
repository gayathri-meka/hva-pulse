import type { FilterFn } from '@tanstack/react-table'

// Multi-select column filter: a row passes if its value is one of the selected
// values (or nothing is selected). Shared by every table via the DataTable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const multiSelectFilter: FilterFn<any> = (row, colId, filterValues: string[]) =>
  !filterValues?.length || filterValues.includes(String(row.getValue(colId) ?? ''))
multiSelectFilter.autoRemove = (val: string[]) => !val?.length

/** Does a row match the global search box, across the given keys (case-insensitive)? */
export function rowMatchesSearch<T>(row: T, keys: (keyof T | string)[], query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return keys.some((k) => String((row as Record<string, unknown>)[k as string] ?? '').toLowerCase().includes(q))
}
