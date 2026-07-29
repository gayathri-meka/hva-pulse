export type NavigationRole = 'admin' | 'staff' | 'guest'

export type ModuleRouteKey =
  | '/dashboard'
  | '/learners'
  | '/learning'
  | '/placements'
  | '/admissions'
  | '/alumni'
  | '/ask-pulse'
  | '/tools'
  | '/learner-view'
  | '/settings'

type RememberedRoutes = Partial<Record<ModuleRouteKey, string>>

const STORAGE_PREFIX = 'hva-pulse:last-module-routes'

const MODULE_ROUTES: Array<{
  key: ModuleRouteKey
  prefixes: string[]
}> = [
  { key: '/dashboard',    prefixes: ['/dashboard'] },
  { key: '/learners',     prefixes: ['/learners'] },
  { key: '/learning',     prefixes: ['/learning'] },
  { key: '/placements',   prefixes: ['/placements', '/outreach'] },
  { key: '/admissions',   prefixes: ['/admissions'] },
  { key: '/alumni',       prefixes: ['/alumni'] },
  { key: '/ask-pulse',    prefixes: ['/ask-pulse'] },
  { key: '/tools',        prefixes: ['/tools'] },
  { key: '/learner-view', prefixes: ['/learner-view'] },
  { key: '/settings',     prefixes: ['/settings', '/users'] },
]

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function getModuleRouteKey(pathname: string): ModuleRouteKey | null {
  return MODULE_ROUTES.find(({ prefixes }) =>
    prefixes.some((prefix) => matchesPrefix(pathname, prefix)),
  )?.key ?? null
}

export function isValidRememberedRoute(key: ModuleRouteKey, route: string) {
  if (!route.startsWith('/') || route.startsWith('//')) return false

  let url: URL
  try {
    url = new URL(route, 'https://pulse.local')
  } catch {
    return false
  }

  // Only internal pathname, query and hash values are permitted.
  if (url.origin !== 'https://pulse.local') return false
  return getModuleRouteKey(url.pathname) === key
}

function storageKey(role: NavigationRole) {
  return `${STORAGE_PREFIX}:${role}`
}

export function readRememberedRoutes(
  storage: Pick<Storage, 'getItem'>,
  role: NavigationRole,
): RememberedRoutes {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(role)) ?? '{}') as Record<string, unknown>
    const valid: RememberedRoutes = {}

    for (const { key } of MODULE_ROUTES) {
      const route = parsed[key]
      if (typeof route === 'string' && isValidRememberedRoute(key, route)) valid[key] = route
    }

    return valid
  } catch {
    return {}
  }
}

export function rememberModuleRoute(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  role: NavigationRole,
  pathname: string,
  query = '',
): RememberedRoutes {
  const key = getModuleRouteKey(pathname)
  const current = readRememberedRoutes(storage, role)
  if (!key) return current

  const route = `${pathname}${query ? `?${query}` : ''}`
  if (!isValidRememberedRoute(key, route) || current[key] === route) return current

  const next = { ...current, [key]: route }
  try {
    storage.setItem(storageKey(role), JSON.stringify(next))
  } catch {
    // Navigation must continue normally when browser storage is unavailable.
  }
  return next
}
