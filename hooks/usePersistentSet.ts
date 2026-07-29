'use client'

import { useMemo, type SetStateAction } from 'react'
import { usePersistentState } from '@/hooks/usePersistentState'

export function usePersistentSet(key: string, initialValues: Iterable<string> = []) {
  const [ids, setIds, hydrated] = usePersistentState<string[]>(
    key,
    [...initialValues],
    { validate: (value): value is string[] =>
      Array.isArray(value) && value.every((id) => typeof id === 'string') },
  )
  const value = useMemo(() => new Set(ids), [ids])

  function setValue(update: SetStateAction<Set<string>>) {
    setIds((current) => {
      const currentSet = new Set(current)
      const next = typeof update === 'function' ? update(currentSet) : update
      return [...next]
    })
  }

  return [value, setValue, hydrated] as const
}
