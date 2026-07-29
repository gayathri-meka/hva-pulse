import { describe, expect, test } from 'vitest'
import { enumParam, updateUrlParams } from '@/lib/urlState'

describe('URL state helpers', () => {
  test('updates values without removing unrelated page state', () => {
    expect(updateUrlParams('view=table&status=open', { q: 'acme' }))
      .toBe('view=table&status=open&q=acme')
  })

  test('removes default or cleared values', () => {
    expect(updateUrlParams('view=detail&q=alex', { view: null, q: '' })).toBe('')
  })

  test('reads allowed enum values and rejects invalid ones', () => {
    const allowed = ['review', 'matrix'] as const
    expect(enumParam(new URLSearchParams('view=matrix'), 'view', allowed, 'review')).toBe('matrix')
    expect(enumParam(new URLSearchParams('view=unsafe'), 'view', allowed, 'review')).toBe('review')
  })
})
