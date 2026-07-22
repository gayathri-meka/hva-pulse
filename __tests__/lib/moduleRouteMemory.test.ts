import { beforeEach, describe, expect, test } from 'vitest'
import {
  getModuleRouteKey,
  isValidRememberedRoute,
  readRememberedRoutes,
  rememberModuleRoute,
} from '@/lib/moduleRouteMemory'

describe('module route memory', () => {
  beforeEach(() => sessionStorage.clear())

  test('maps nested and alias routes to their main module', () => {
    expect(getModuleRouteKey('/placements/companies')).toBe('/placements')
    expect(getModuleRouteKey('/outreach/opportunities')).toBe('/placements')
    expect(getModuleRouteKey('/admissions/interviews/calendar')).toBe('/admissions')
    expect(getModuleRouteKey('/users')).toBe('/settings')
    expect(getModuleRouteKey('/candidate/welcome')).toBeNull()
  })

  test('remembers independent module routes including their query strings', () => {
    rememberModuleRoute(sessionStorage, 'staff', '/placements/companies', 'view=table')
    rememberModuleRoute(sessionStorage, 'staff', '/learning', 'view=table&filter=open')

    expect(readRememberedRoutes(sessionStorage, 'staff')).toEqual({
      '/placements': '/placements/companies?view=table',
      '/learning': '/learning?view=table&filter=open',
    })
  })

  test('updates only the module that is visited again', () => {
    rememberModuleRoute(sessionStorage, 'staff', '/placements/companies', 'view=table')
    rememberModuleRoute(sessionStorage, 'staff', '/learning/deep-dive')
    rememberModuleRoute(sessionStorage, 'staff', '/placements/applications', 'status=hired')

    expect(readRememberedRoutes(sessionStorage, 'staff')).toEqual({
      '/placements': '/placements/applications?status=hired',
      '/learning': '/learning/deep-dive',
    })
  })

  test('keeps navigation memory separate for each role', () => {
    rememberModuleRoute(sessionStorage, 'admin', '/settings/email')
    rememberModuleRoute(sessionStorage, 'guest', '/alumni', 'view=cohort')

    expect(readRememberedRoutes(sessionStorage, 'admin')).toEqual({
      '/settings': '/settings/email',
    })
    expect(readRememberedRoutes(sessionStorage, 'guest')).toEqual({
      '/alumni': '/alumni?view=cohort',
    })
  })

  test('rejects external, malformed and cross-module stored routes', () => {
    expect(isValidRememberedRoute('/placements', 'https://example.com/placements')).toBe(false)
    expect(isValidRememberedRoute('/placements', '//example.com/placements')).toBe(false)
    expect(isValidRememberedRoute('/placements', '/learning')).toBe(false)
    expect(isValidRememberedRoute('/placements', '/placements/companies?view=table')).toBe(true)
  })

  test('ignores invalid and corrupted storage values', () => {
    sessionStorage.setItem('hva-pulse:last-module-routes:staff', JSON.stringify({
      '/placements': '/learning',
      '/learning': 'https://example.com/learning',
      '/alumni': '/alumni?view=cohort',
    }))
    expect(readRememberedRoutes(sessionStorage, 'staff')).toEqual({
      '/alumni': '/alumni?view=cohort',
    })

    sessionStorage.setItem('hva-pulse:last-module-routes:staff', '{broken')
    expect(readRememberedRoutes(sessionStorage, 'staff')).toEqual({})
  })
})
