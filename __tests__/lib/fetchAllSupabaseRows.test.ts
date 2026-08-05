import { describe, expect, test, vi } from 'vitest'
import { fetchAllSupabaseRows, fetchAllSupabaseRowsIfTableExists } from '@/lib/fetchAllSupabaseRows'

describe('fetchAllSupabaseRows', () => {
  test('loads successive inclusive ranges until the final short page', async () => {
    const range = vi.fn(async (from: number, to: number) => ({ data: [0, 1, 2, 3, 4].slice(from, to + 1), error: null }))
    await expect(fetchAllSupabaseRows({ range }, 2)).resolves.toEqual([0, 1, 2, 3, 4])
    expect(range.mock.calls).toEqual([[0, 1], [2, 3], [4, 5]])
  })

  test('returns an empty result and surfaces query errors', async () => {
    await expect(fetchAllSupabaseRows({ range: async () => ({ data: [], error: null }) }, 10)).resolves.toEqual([])
    await expect(fetchAllSupabaseRows({ range: async () => ({ data: null, error: { message: 'db failed' } }) })).rejects.toThrow('db failed')
  })

  test('rejects an invalid page size', async () => {
    await expect(fetchAllSupabaseRows({ range: async () => ({ data: [], error: null }) }, 0)).rejects.toThrow('positive integer')
  })
})

describe('fetchAllSupabaseRowsIfTableExists', () => {
  test('returns an empty collection only when the named table is missing', async () => {
    const missing = { range: async () => ({ data: null, error: { message: "Could not find the table 'public.coding_interview_reviews' in the schema cache" } }) }
    await expect(fetchAllSupabaseRowsIfTableExists(missing, 'coding_interview_reviews')).resolves.toEqual([])
  })

  test('does not hide unrelated database errors', async () => {
    const failed = { range: async () => ({ data: null, error: { message: 'connection failed' } }) }
    await expect(fetchAllSupabaseRowsIfTableExists(failed, 'coding_interview_reviews')).rejects.toThrow('connection failed')
  })
})
