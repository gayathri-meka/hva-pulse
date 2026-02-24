import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
vi.mock('next/cache',      () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth',      () => ({ getAppUser: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { deleteUser } from '@/app/(protected)/users/actions'

const adminUser  = { id: 'admin-1',   role: 'admin'   as const, name: 'Admin',   email: 'admin@test.com' }
const learnerUser = { id: 'learner-1', role: 'learner' as const, name: 'Learner', email: 'learner@test.com' }

function makeSupabaseMock() {
  const mockEq     = vi.fn().mockResolvedValue({ error: null })
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
  const mockClient = { from: vi.fn().mockReturnValue({ delete: mockDelete }) }
  return { mockClient, mockDelete, mockEq }
}

describe('deleteUser', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('redirects when caller is not admin', async () => {
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
    await expect(deleteUser('some-user-id')).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  test('returns error when admin tries to delete their own account', async () => {
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    const result = await deleteUser('admin-1')
    expect(result).toEqual({ error: 'You cannot delete your own account.' })
  })

  test('deletes the user when called by admin on a different user', async () => {
    const { mockClient, mockEq } = makeSupabaseMock()
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await deleteUser('other-user-id')

    expect(result).toEqual({})
    expect(mockEq).toHaveBeenCalledWith('id', 'other-user-id')
  })

  test('returns error when Supabase reports a failure', async () => {
    const mockEq     = vi.fn().mockResolvedValue({ error: { message: 'Foreign key violation' } })
    const mockClient = { from: vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEq }) }) }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await deleteUser('other-user-id')

    expect(result).toEqual({ error: 'Foreign key violation' })
  })
})
