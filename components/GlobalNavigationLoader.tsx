'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

// Universal navigation loader. Any internal anchor click is intercepted and a
// timer queues the loader; the timer is cancelled if the URL changes quickly
// enough (so fast nav doesn't flash). For programmatic transitions (filter
// dropdowns, router.push elsewhere), components can call `start()` via the
// context hook — same delay + auto-hide behaviour applies.
//
// The provider exposes `active` so the actual loader can render INSIDE the
// AppShell's main slot, matching Next.js's native loading.tsx behaviour where
// the sidebar/topbar stay visible.

const SHOW_DELAY_MS = 150       // wait before showing — skips instant navs
const SAFETY_MAX_MS  = 8000     // hide regardless, in case URL never changes

type Ctx = { start: () => void; active: boolean }
const NavLoaderCtx = createContext<Ctx | null>(null)

export function useNavigationLoader(): Ctx {
  const ctx = useContext(NavLoaderCtx)
  // No-op fallback so calling components don't crash when rendered outside the
  // provider (e.g. in tests or in the learner route group).
  return ctx ?? { start: () => {}, active: false }
}

export default function GlobalNavigationLoader({ children }: { children: ReactNode }) {
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [active, setActive] = useState(false)

  // Track timers so we can cancel on URL change. showTimer queues the loader;
  // safetyTimer auto-hides it.
  const showTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearTimers() {
    if (showTimer.current)   { clearTimeout(showTimer.current);   showTimer.current   = null }
    if (safetyTimer.current) { clearTimeout(safetyTimer.current); safetyTimer.current = null }
  }

  function start() {
    clearTimers()
    showTimer.current = setTimeout(() => {
      setActive(true)
      safetyTimer.current = setTimeout(() => setActive(false), SAFETY_MAX_MS)
    }, SHOW_DELAY_MS)
  }

  // URL change = navigation complete. Cancel any pending timer and hide.
  useEffect(() => {
    clearTimers()
    setActive(false)
    // pathname/searchParams in deps; once they update the effect fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Global click handler — catches every internal anchor without needing to
  // touch individual components.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Plain left-click only; let cmd/ctrl/shift/middle-click open tabs.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = (e.target as Element | null)?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      // Internal navigations only.
      if (!href.startsWith('/') || href.startsWith('//')) return
      // Skip target=_blank.
      if (anchor.getAttribute('target') === '_blank') return
      // Skip "same URL" clicks (re-clicking the active tab).
      const current = pathname + (searchParams.toString() ? '?' + searchParams.toString() : '')
      if (href === current) return

      start()
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  return (
    <NavLoaderCtx.Provider value={{ start, active }}>
      {children}
    </NavLoaderCtx.Provider>
  )
}
