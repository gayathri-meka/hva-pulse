import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import { usePersistentSet } from '@/hooks/usePersistentSet'

describe('usePersistentSet', () => {
  beforeEach(() => sessionStorage.clear())

  test('persists multi-select values across remounts', async () => {
    const first = renderHook(() => usePersistentSet('filters', ['a']))
    act(() => first.result.current[1]((current) => new Set([...current, 'b'])))
    await waitFor(() => expect(sessionStorage.getItem('hva-pulse:state:filters')).toContain('b'))
    first.unmount()

    const second = renderHook(() => usePersistentSet('filters'))
    await waitFor(() => expect([...second.result.current[0]].sort()).toEqual(['a', 'b']))
  })
})
