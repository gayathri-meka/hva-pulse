import { describe, expect, test, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import SourceSyncButton from '@/components/learning/SourceSyncButton'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/(protected)/learning/actions', () => ({ syncDataSource: vi.fn() }))

describe('SourceSyncButton hydration', () => {
  test('server output does not depend on the current clock', () => {
    const sources = [{
      id: 'source-1',
      name: 'Challenge data',
      last_synced_at: '2026-07-22T00:00:00.000Z',
      sync_error: null,
      row_count: 10,
    }]
    const now = vi.spyOn(Date, 'now')
    now.mockReturnValue(new Date('2026-07-22T01:52:00.000Z').getTime())
    const first = renderToString(<SourceSyncButton sources={sources} />)
    now.mockReturnValue(new Date('2026-07-22T01:53:00.000Z').getTime())
    const second = renderToString(<SourceSyncButton sources={sources} />)

    expect(first).toBe(second)
    expect(first).toContain('Synced')
    expect(first).not.toContain('52m ago')
    expect(first).not.toContain('53m ago')
    now.mockRestore()
  })
})
