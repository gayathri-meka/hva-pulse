import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import { usePersistentState } from '@/hooks/usePersistentState'

describe('usePersistentState', () => {
  beforeEach(() => sessionStorage.clear())

  test('restores a validated value after remounting', async () => {
    const first = renderHook(() => usePersistentState('page:view', 'review'))
    act(() => first.result.current[1]('matrix'))
    await waitFor(() => expect(sessionStorage.getItem('hva-pulse:state:page:view')).toBe('"matrix"'))
    first.unmount()

    const second = renderHook(() => usePersistentState('page:view', 'review'))
    await waitFor(() => expect(second.result.current[0]).toBe('matrix'))
  })

  test('uses an explicit value instead of restoring session state', async () => {
    sessionStorage.setItem('hva-pulse:state:page:view', '"matrix"')
    const { result } = renderHook(() => usePersistentState('page:view', 'questions', { restore: false }))
    await waitFor(() => expect(result.current[0]).toBe('questions'))
  })

  test('rejects invalid stored values', async () => {
    sessionStorage.setItem('hva-pulse:state:page:view', '"unsafe"')
    const { result } = renderHook(() => usePersistentState(
      'page:view',
      'review',
      { validate: (value): value is string => value === 'review' || value === 'matrix' },
    ))
    await waitFor(() => expect(result.current[0]).toBe('review'))
  })
})
