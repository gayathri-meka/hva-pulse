import { describe, test, expect } from 'vitest'
import { computeSheetSync, colToA1, parseSpreadsheetId } from '@/lib/sheetSync'

type Row = { id: string; name: string; status?: string; score?: number }

const cfg = {
  keyHeader: 'id',
  key: (r: Row) => r.id,
  columns: [{ header: 'name', value: (r: Row) => r.name }],
}

describe('parseSpreadsheetId', () => {
  test('extracts the id from a full sheet URL', () => {
    expect(parseSpreadsheetId('https://docs.google.com/spreadsheets/d/1AbC-dEf_123/edit#gid=0')).toBe('1AbC-dEf_123')
    expect(parseSpreadsheetId('  https://docs.google.com/spreadsheets/d/XYZ789/edit ')).toBe('XYZ789')
  })
  test('accepts a bare id', () => {
    expect(parseSpreadsheetId('1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P')).toBe('1A2B3C4D5E6F7G8H9I0J1K2L3M4N5O6P')
  })
  test('rejects junk', () => {
    expect(parseSpreadsheetId('not a link')).toBeNull()
    expect(parseSpreadsheetId('')).toBeNull()
  })
})

describe('colToA1', () => {
  test('maps indices to spreadsheet column letters', () => {
    expect(colToA1(0)).toBe('A')
    expect(colToA1(1)).toBe('B')
    expect(colToA1(25)).toBe('Z')
    expect(colToA1(26)).toBe('AA')
    expect(colToA1(27)).toBe('AB')
    expect(colToA1(51)).toBe('AZ')
    expect(colToA1(52)).toBe('BA')
  })
})

describe('computeSheetSync', () => {
  test('empty sheet → writes header and appends every row', () => {
    const plan = computeSheetSync('S', [], [{ id: '1', name: 'A' }, { id: '2', name: 'B' }], cfg)
    expect(plan.headerRow).toEqual(['id', 'name'])
    expect(plan.appends).toEqual([['1', 'A'], ['2', 'B']])
    expect(plan.updates).toEqual([])
    expect(plan.stats).toEqual({ updated: 0, added: 2, unchanged: 0 })
  })

  test('only changed managed cells are updated; unmanaged columns untouched', () => {
    const existing = [
      ['id', 'name', 'notes'],
      ['1', 'Alice', 'manual note A'],
      ['2', 'Bob', 'manual note B'],
    ]
    const rows: Row[] = [
      { id: '1', name: 'Alice' }, // unchanged
      { id: '2', name: 'Bobby' }, // name changed
      { id: '3', name: 'Carol' }, // new
    ]
    const plan = computeSheetSync('Sheet1', existing, rows, cfg)

    expect(plan.headerRow).toBeNull()
    // Only Bob's name cell (col B, row 3) is written — NOT the notes column.
    expect(plan.updates).toEqual([{ a1: "'Sheet1'!B3", value: 'Bobby' }])
    // New row keeps the unmanaged 'notes' column blank.
    expect(plan.appends).toEqual([['3', 'Carol', '']])
    expect(plan.stats).toEqual({ updated: 1, added: 1, unchanged: 1 })
  })

  test('appends a managed column when its header is missing', () => {
    const existing = [['id', 'name'], ['1', 'Alice']]
    const rows: Row[] = [{ id: '1', name: 'Alice', score: 90 }]
    const plan = computeSheetSync('Sheet1', existing, rows, {
      keyHeader: 'id',
      key: (r: Row) => r.id,
      columns: [
        { header: 'name', value: (r: Row) => r.name },
        { header: 'score', value: (r: Row) => r.score },
      ],
    })
    // header gets 'score' appended; the new cell is written at the new column C.
    expect(plan.headerRow).toEqual(['id', 'name', 'score'])
    expect(plan.updates).toEqual([{ a1: "'Sheet1'!C2", value: '90' }])
    expect(plan.stats.updated).toBe(1)
  })

  test('key matching trims/normalises whitespace', () => {
    const existing = [['id', 'name'], [' 1 ', 'Alice']]
    const rows: Row[] = [{ id: '1', name: 'Alex' }]
    const plan = computeSheetSync('S', existing, rows, cfg)
    expect(plan.appends).toEqual([]) // matched the ' 1 ' row, not appended
    expect(plan.updates).toEqual([{ a1: "'S'!B2", value: 'Alex' }])
  })

  test('addNewRows:false suppresses appends', () => {
    const existing = [['id', 'name'], ['1', 'Alice']]
    const rows: Row[] = [{ id: '2', name: 'Bob' }]
    const plan = computeSheetSync('S', existing, rows, { ...cfg, addNewRows: false })
    expect(plan.appends).toEqual([])
    expect(plan.stats.added).toBe(0)
  })

  test('quotes a tab name that contains spaces', () => {
    const existing = [['id', 'name'], ['1', 'Alice']]
    const plan = computeSheetSync('My Tab', existing, [{ id: '1', name: 'Z' }], cfg)
    expect(plan.updates[0].a1).toBe("'My Tab'!B2")
  })

  test('throws when the key column is absent from the sheet header', () => {
    const existing = [['name', 'notes'], ['Alice', 'x']]
    expect(() => computeSheetSync('S', existing, [{ id: '1', name: 'A' }], cfg)).toThrow(/key column/)
  })
})
