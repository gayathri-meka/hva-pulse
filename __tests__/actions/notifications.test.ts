import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getAppUser: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { getAppUser }                 from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { revalidatePath }             from 'next/cache'
import {
  markNotificationRead,
  markAllNotificationsRead,
} from '@/app/(protected)/notifications/actions'

const user = { id: 'user-1', role: 'admin' as const, name: 'A', email: 'a@test.com' }

function mockSupabase() {
  const mockEq     = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockFrom   = vi.fn().mockReturnValue({ update: mockUpdate })
  vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: mockFrom } as any)
  return { mockFrom, mockUpdate, mockEq }
}

describe('markNotificationRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUser).mockResolvedValue(user)
  })

  test('throws when unauthenticated', async () => {
    vi.mocked(getAppUser).mockResolvedValueOnce(null)
    await expect(markNotificationRead('n-1')).rejects.toThrow('Not authenticated')
  })

  test('marks the specific notification as read', async () => {
    const { mockFrom, mockUpdate, mockEq } = mockSupabase()
    await markNotificationRead('n-1')
    expect(mockFrom).toHaveBeenCalledWith('notifications')
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true })
    expect(mockEq).toHaveBeenCalledWith('id', 'n-1')
  })

  test('revalidates layout so bell badge updates', async () => {
    mockSupabase()
    await markNotificationRead('n-1')
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
  })
})

describe('markAllNotificationsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUser).mockResolvedValue(user)
  })

  test('throws when unauthenticated', async () => {
    vi.mocked(getAppUser).mockResolvedValueOnce(null)
    await expect(markAllNotificationsRead()).rejects.toThrow('Not authenticated')
  })

  test('updates every unread notification', async () => {
    const { mockUpdate, mockEq } = mockSupabase()
    await markAllNotificationsRead()
    expect(mockUpdate).toHaveBeenCalledWith({ is_read: true })
    expect(mockEq).toHaveBeenCalledWith('is_read', false)
  })
})
