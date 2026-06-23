import { describe, test, expect } from 'vitest'
import { multiSelectFilter, rowMatchesSearch } from '@/lib/tableFilters'

describe('rowMatchesSearch', () => {
  const row = { name: 'Vinita Gupta', email: 'V@X.com', phone: null }

  test('empty query matches everything', () => {
    expect(rowMatchesSearch(row, ['name', 'email'], '')).toBe(true)
    expect(rowMatchesSearch(row, ['name'], '   ')).toBe(true)
  })
  test('case-insensitive substring match across keys', () => {
    expect(rowMatchesSearch(row, ['name', 'email'], 'gupta')).toBe(true)
    expect(rowMatchesSearch(row, ['name', 'email'], 'v@x')).toBe(true)
  })
  test('no match returns false', () => {
    expect(rowMatchesSearch(row, ['name', 'email'], 'zzz')).toBe(false)
  })
  test('null/missing fields are treated as empty, not crashes', () => {
    expect(rowMatchesSearch(row, ['phone'], 'anything')).toBe(false)
  })
})

describe('multiSelectFilter', () => {
  const mkRow = (v: string) => ({ getValue: () => v }) as never

  test('no selection passes everything', () => {
    expect(multiSelectFilter(mkRow('a'), 'c', [], () => {})).toBe(true)
    expect(multiSelectFilter(mkRow('a'), 'c', undefined as never, () => {})).toBe(true)
  })
  test('passes only when the value is selected', () => {
    expect(multiSelectFilter(mkRow('Yes'), 'c', ['Yes', 'No'], () => {})).toBe(true)
    expect(multiSelectFilter(mkRow('Maybe'), 'c', ['Yes', 'No'], () => {})).toBe(false)
  })
  test('autoRemove drops an empty filter', () => {
    expect(multiSelectFilter.autoRemove?.([] as string[], {} as never)).toBe(true)
    expect(multiSelectFilter.autoRemove?.(['Yes'], {} as never)).toBe(false)
  })
})
