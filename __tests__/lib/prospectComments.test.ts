import { describe, test, expect } from 'vitest'
import { normEmail, groupCommentsByEmail, type ProspectComment } from '@/lib/prospectComments'

function comment(email: string, body: string, created_at: string): ProspectComment {
  return { id: `${email}-${created_at}`, email, body, author_id: 'u1', author_name: 'Tester', created_at }
}

describe('normEmail', () => {
  test('lowercases and trims', () => {
    expect(normEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })
  test('null / undefined → empty string', () => {
    expect(normEmail(null)).toBe('')
    expect(normEmail(undefined)).toBe('')
  })
})

describe('groupCommentsByEmail', () => {
  test('groups by normalised email so mixed-case rows share a thread', () => {
    const rows = [
      comment('A@x.com', 'first', '2026-06-01T00:00:00Z'),
      comment('a@x.com', 'second', '2026-06-02T00:00:00Z'),
      comment('other@x.com', 'lone', '2026-06-01T00:00:00Z'),
    ]
    const map = groupCommentsByEmail(rows)
    expect(Object.keys(map).sort()).toEqual(['a@x.com', 'other@x.com'])
    expect(map['a@x.com']).toHaveLength(2)
  })

  test('sorts each thread newest first', () => {
    const rows = [
      comment('a@x.com', 'older', '2026-06-01T00:00:00Z'),
      comment('a@x.com', 'newest', '2026-06-03T00:00:00Z'),
      comment('a@x.com', 'middle', '2026-06-02T00:00:00Z'),
    ]
    const map = groupCommentsByEmail(rows)
    expect(map['a@x.com'].map((c) => c.body)).toEqual(['newest', 'middle', 'older'])
  })

  test('skips rows with blank email', () => {
    const rows = [comment('', 'no home', '2026-06-01T00:00:00Z')]
    expect(groupCommentsByEmail(rows)).toEqual({})
  })

  test('empty input → empty map', () => {
    expect(groupCommentsByEmail([])).toEqual({})
  })
})
