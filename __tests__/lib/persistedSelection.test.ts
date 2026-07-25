import { describe, expect, test } from 'vitest'
import { reconcileSelection, setsEqual } from '@/lib/persistedSelection'

describe('persisted selection reconciliation', () => {
  test('removes values that no longer exist', () => {
    expect([...reconcileSelection(new Set(['FY25', 'FY26']), ['FY26', 'FY27'])])
      .toEqual(['FY26'])
  })

  test('can safely fall back to all current options', () => {
    expect([...reconcileSelection(new Set(['old-call']), ['call-a', 'call-b'], true)])
      .toEqual(['call-a', 'call-b'])
  })

  test('recognizes equivalent sets regardless of insertion order', () => {
    expect(setsEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true)
  })
})
