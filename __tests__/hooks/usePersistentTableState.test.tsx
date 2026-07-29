import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import { usePersistentTableState } from '@/hooks/usePersistentTableState'

describe('usePersistentTableState', () => {
  beforeEach(() => sessionStorage.clear())

  test('updates filters immediately without changing the URL', () => {
    window.history.replaceState(null, '', '/placements/applications?status=applied')
    const { result } = renderHook(() => usePersistentTableState('applications', []))

    act(() => result.current.onColumnFiltersChange([{ id: 'company', value: ['Acme'] }]))

    expect(result.current.columnFilters).toEqual([{ id: 'company', value: ['Acme'] }])
    expect(window.location.pathname + window.location.search)
      .toBe('/placements/applications?status=applied')
  })

  test('persists sorting, filters and search in the current session', async () => {
    const first = renderHook(() => usePersistentTableState('applications', []))
    act(() => {
      first.result.current.onSortingChange([{ id: 'learner', desc: true }])
      first.result.current.onColumnFiltersChange([{ id: 'status', value: ['hired'] }])
      first.result.current.setSearch('Priya')
    })

    await waitFor(() => expect(sessionStorage.getItem('hva-pulse:table-state:applications')).toContain('Priya'))
    first.unmount()

    const second = renderHook(() => usePersistentTableState('applications', []))
    await waitFor(() => {
      expect(second.result.current.sorting).toEqual([{ id: 'learner', desc: true }])
      expect(second.result.current.columnFilters).toEqual([{ id: 'status', value: ['hired'] }])
      expect(second.result.current.search).toBe('Priya')
    })
  })

  test('falls back safely when stored state is corrupted', async () => {
    sessionStorage.setItem('hva-pulse:table-state:applications', '{broken')
    const { result } = renderHook(() =>
      usePersistentTableState('applications', [{ id: 'created_at', desc: true }]),
    )

    await waitFor(() => expect(result.current.sorting).toEqual([{ id: 'created_at', desc: true }]))
    expect(result.current.columnFilters).toEqual([])
    expect(result.current.search).toBe('')
  })

  test('rejects arrays containing malformed table state', async () => {
    sessionStorage.setItem('hva-pulse:table-state:applications', JSON.stringify({
      sorting: [{ id: 123, desc: 'yes' }],
      columnFilters: [{ value: 'missing-id' }],
      search: 42,
    }))
    const { result } = renderHook(() =>
      usePersistentTableState('applications', [{ id: 'created_at', desc: true }]),
    )

    await waitFor(() => expect(result.current.sorting).toEqual([{ id: 'created_at', desc: true }]))
    expect(result.current.columnFilters).toEqual([])
    expect(result.current.search).toBe('')
  })
})
