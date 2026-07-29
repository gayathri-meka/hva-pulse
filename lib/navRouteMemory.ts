export type RememberedNavGroup = {
  key: string
  fallback: string
  prefixes?: readonly string[]
}

export type RememberedNavRoutes = Record<string, string>

const STORAGE_PREFIX = 'hva-pulse:last-nav-routes'
const INTERNAL_ORIGIN = 'https://pulse.local'

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function prefixesFor(group: RememberedNavGroup) {
  return group.prefixes ?? [group.fallback]
}

export function findRememberedNavGroup(
  groups: readonly RememberedNavGroup[],
  pathname: string,
) {
  return groups
    .flatMap((group) => prefixesFor(group).map((prefix) => ({ group, prefix })))
    .filter(({ prefix }) => matchesPrefix(pathname, prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]?.group ?? null
}

export function isValidNavRoute(group: RememberedNavGroup, route: string) {
  if (!route.startsWith('/') || route.startsWith('//')) return false

  try {
    const url = new URL(route, INTERNAL_ORIGIN)
    return url.origin === INTERNAL_ORIGIN
      && prefixesFor(group).some((prefix) => matchesPrefix(url.pathname, prefix))
  } catch {
    return false
  }
}

function storageKey(namespace: string) {
  return `${STORAGE_PREFIX}:${namespace}`
}

export function readRememberedNavRoutes(
  storage: Pick<Storage, 'getItem'>,
  namespace: string,
  groups: readonly RememberedNavGroup[],
): RememberedNavRoutes {
  try {
    const parsed = JSON.parse(storage.getItem(storageKey(namespace)) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(groups.flatMap((group) => {
      const route = parsed[group.key]
      return typeof route === 'string' && isValidNavRoute(group, route)
        ? [[group.key, route]]
        : []
    }))
  } catch {
    return {}
  }
}

export function rememberNavRoute(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  namespace: string,
  groups: readonly RememberedNavGroup[],
  pathname: string,
  query = '',
) {
  const current = readRememberedNavRoutes(storage, namespace, groups)
  const group = findRememberedNavGroup(groups, pathname)
  if (!group) return current

  const route = `${pathname}${query ? `?${query}` : ''}`
  if (!isValidNavRoute(group, route) || current[group.key] === route) return current

  const next = { ...current, [group.key]: route }
  try {
    storage.setItem(storageKey(namespace), JSON.stringify(next))
  } catch {
    // Storage can be unavailable; fixed fallback links still keep navigation usable.
  }
  return next
}
