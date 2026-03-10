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
import { deleteUser, addUser, updateUser } from '@/app/(protected)/users/actions'

const adminUser   = { id: 'admin-1',   role: 'admin'   as const, name: 'Admin',   email: 'admin@test.com' }
const learnerUser = { id: 'learner-1', role: 'learner' as const, name: 'Learner', email: 'learner@test.com' }

// ── deleteUser ────────────────────────────────────────────────────────────────

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
    const mockEq     = vi.fn().mockResolvedValue({ error: null })
    const mockClient = { from: vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEq }) }) }
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

// ── addUser ───────────────────────────────────────────────────────────────────

describe('addUser', () => {
  beforeEach(() => { vi.clearAllMocks() })

  function makeFormData(email: string, name: string, role: string) {
    const fd = new FormData()
    fd.set('email', email)
    fd.set('name', name)
    fd.set('role', role)
    return fd
  }

  test('redirects when caller is not admin', async () => {
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
    await expect(addUser({}, makeFormData('x@x.com', 'X', 'LF'))).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  test('returns error when email already exists', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { email: 'dupe@test.com' } }) }),
        }),
      }),
    }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await addUser({}, makeFormData('dupe@test.com', 'Dupe', 'LF'))

    expect(result.error).toBe('A user with this email already exists.')
  })

  test('inserts user and returns empty object on success', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // duplicate check — not found
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }),
            }),
          }
        }
        return { insert: mockInsert }
      }),
    }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await addUser({}, makeFormData('new@test.com', 'New User', 'LF'))

    expect(result.error).toBeUndefined()
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new@test.com',
      role:  'LF',
    }))
  })

  test('normalises email to lowercase', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }),
            }),
          }
        }
        return { insert: mockInsert }
      }),
    }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await addUser({}, makeFormData('UPPER@CASE.COM', 'Test', 'LF'))

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ email: 'upper@case.com' }))
  })

  test('returns error when Supabase insert fails', async () => {
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null }) }),
            }),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }) }
      }),
    }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await addUser({}, makeFormData('new@test.com', 'Test', 'LF'))

    expect(result.error).toBe('insert failed')
  })
})

// ── updateUser ────────────────────────────────────────────────────────────────

describe('updateUser', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('redirects when caller is not admin', async () => {
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
    await expect(updateUser('u-1', { name: 'X', email: 'x@x.com', role: 'LF' })).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  test('returns error when email is already in use by another user', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'other-user' } }) }),
          }),
        }),
      }),
    }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await updateUser('u-1', { name: 'X', email: 'taken@test.com', role: 'LF' })

    expect(result.error).toBe('Email already in use by another user')
  })

  test('updates user record on success', async () => {
    const mockEq     = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // conflict check — no conflict
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
              }),
            }),
          }
        }
        return { update: mockUpdate }
      }),
    }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await updateUser('u-1', { name: 'Updated', email: 'updated@test.com', role: 'admin' })

    expect(result.error).toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      email: 'updated@test.com',
      role:  'admin',
    }))
    expect(mockEq).toHaveBeenCalledWith('id', 'u-1')
  })

  test('returns error when Supabase update fails', async () => {
    const mockEq     = vi.fn().mockResolvedValue({ error: { message: 'update failed' } })
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                neq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
              }),
            }),
          }
        }
        return { update: mockUpdate }
      }),
    }
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await updateUser('u-1', { name: 'X', email: 'x@x.com', role: 'LF' })

    expect(result.error).toBe('update failed')
  })
})
