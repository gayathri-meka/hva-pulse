import { describe, expect, it } from 'vitest'
import {
  findRememberedNavGroup,
  isValidNavRoute,
  readRememberedNavRoutes,
  rememberNavRoute,
  type RememberedNavGroup,
} from '@/lib/navRouteMemory'

const groups = [
  { key: 'challenge', fallback: '/admissions/challenge' },
  { key: 'interviews', fallback: '/admissions/interviews' },
] satisfies RememberedNavGroup[]

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('navRouteMemory', () => {
  it('restores the latest nested route and query for each tab independently', () => {
    const storage = memoryStorage()
    rememberNavRoute(storage, 'admissions', groups, '/admissions/interviews/list', 'view=past')
    rememberNavRoute(storage, 'admissions', groups, '/admissions/challenge', 'view=table')

    expect(readRememberedNavRoutes(storage, 'admissions', groups)).toEqual({
      interviews: '/admissions/interviews/list?view=past',
      challenge: '/admissions/challenge?view=table',
    })
  })

  it('uses the most-specific group for nested navigation', () => {
    const nested = [
      { key: 'overview', fallback: '/admissions/interviews' },
      { key: 'notes', fallback: '/admissions/interviews/notes' },
    ]

    expect(findRememberedNavGroup(nested, '/admissions/interviews/notes/123')?.key).toBe('notes')
  })

  it('supports a parent tab made from multiple route prefixes', () => {
    const outreach = {
      key: 'outreach',
      fallback: '/placements/personas',
      prefixes: ['/placements/personas', '/placements/opportunities'],
    }

    expect(isValidNavRoute(outreach, '/placements/opportunities/42?status=open')).toBe(true)
  })

  it('rejects external and cross-tab stored routes', () => {
    expect(isValidNavRoute(groups[1], 'https://example.com/admissions/interviews')).toBe(false)
    expect(isValidNavRoute(groups[1], '//example.com/admissions/interviews')).toBe(false)
    expect(isValidNavRoute(groups[1], '/admissions/challenge')).toBe(false)
  })
})
