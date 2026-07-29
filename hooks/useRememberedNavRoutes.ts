'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  rememberNavRoute,
  type RememberedNavGroup,
  type RememberedNavRoutes,
} from '@/lib/navRouteMemory'

export function useRememberedNavRoutes(
  namespace: string,
  groups: readonly RememberedNavGroup[],
) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const query = searchParams.toString()
  const [routes, setRoutes] = useState<RememberedNavRoutes>({})

  useEffect(() => {
    setRoutes(rememberNavRoute(window.sessionStorage, namespace, groups, pathname, query))
  }, [groups, namespace, pathname, query])

  return (group: RememberedNavGroup) => routes[group.key] ?? group.fallback
}
