'use client'

import { startTransition, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { updateUrlParams } from '@/lib/urlState'

export function useClientUrlUpdates(delay = 250) {
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<Record<string, string | null>>({})
  const modeRef = useRef<'push' | 'replace'>('replace')

  function flush() {
    if (Object.keys(pendingRef.current).length === 0) return
    const query = updateUrlParams(window.location.search.slice(1), pendingRef.current)
    pendingRef.current = {}
    const url = `${pathname}${query ? `?${query}` : ''}`
    const method = modeRef.current === 'push' ? 'pushState' : 'replaceState'
    modeRef.current = 'replace'
    startTransition(() => window.history[method](null, '', url))
  }

  function schedule(updates: Record<string, string | null>, mode: 'push' | 'replace' = 'push') {
    pendingRef.current = { ...pendingRef.current, ...updates }
    if (mode === 'push') modeRef.current = 'push'
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, delay)
  }

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (window.location.pathname === pathname) flush()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return schedule
}
