'use client'

import { useEffect, useState } from 'react'

type Options<T> = {
  restore?: boolean
  validate?: (value: unknown) => value is T
}

export function usePersistentState<T>(key: string, initialValue: T, options: Options<T> = {}) {
  const { restore = true, validate } = options
  const [value, setValue] = useState(initialValue)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!restore) {
      setValue(initialValue)
      setHydrated(true)
      return
    }
    try {
      const raw = sessionStorage.getItem(`hva-pulse:state:${key}`)
      if (raw != null) {
        const stored: unknown = JSON.parse(raw)
        if (!validate || validate(stored)) setValue(stored as T)
      }
    } catch {
      // Invalid session data falls back to the supplied initial value.
    }
    setHydrated(true)
  // initialValue is the SSR-safe fallback; URL changes toggle restore or remount the page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, restore])

  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(`hva-pulse:state:${key}`, JSON.stringify(value))
    } catch {
      // Interaction must continue when browser storage is unavailable.
    }
  }, [hydrated, key, value])

  return [value, setValue, hydrated] as const
}
