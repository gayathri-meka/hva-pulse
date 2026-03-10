import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
vi.mock('next/cache',      () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  getAppUser: vi.fn(),
}))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { getAppUser }               from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  uploadResume,
  applyToRole,
  markNotInterested,
  removeNotInterested,
  deleteResume,
} from '@/app/(learner)/learner/actions'

const learnerUser = { id: 'user-1', role: 'learner' as const, name: 'Test Learner', email: 'learner@test.com' }
const adminUser   = { id: 'admin-1', role: 'admin'   as const, name: 'Admin',        email: 'admin@test.com' }

function makeFile(overrides: Partial<{ name: string; size: number; type: string }> = {}) {
  const { name = 'resume.pdf', size = 100_000, type = 'application/pdf' } = overrides
  const file = new File(['x'.repeat(size)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

function makeFormData(file: File, versionName = 'v1') {
  const fd = new FormData()
  fd.set('file', file)
  fd.set('version_name', versionName)
  return fd
}

function makeSupabaseMock() {
  const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/resume.pdf' } })
  const upload       = vi.fn().mockResolvedValue({ data: { path: 'user-1/123.pdf' }, error: null })
  const remove       = vi.fn().mockResolvedValue({ error: null })
  const insert       = vi.fn().mockResolvedValue({ error: null })
  const storage      = { from: vi.fn().mockReturnValue({ upload, remove, getPublicUrl }) }
  const from         = vi.fn().mockReturnValue({ insert })
  return { mockClient: { storage, from }, upload, remove, insert }
}

// ── uploadResume ──────────────────────────────────────────────────────────────

describe('uploadResume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
  })

  test('rejects non-learner users', async () => {
    vi.mocked(getAppUser).mockResolvedValue({ ...learnerUser, role: 'admin' })
    await expect(uploadResume(makeFormData(makeFile()))).rejects.toThrow('NEXT_REDIRECT')
  })

  test('returns error when no file', async () => {
    const fd = new FormData()
    fd.set('file', new File([], 'empty.pdf', { type: 'application/pdf' }))
    fd.set('version_name', 'v1')
    const result = await uploadResume(fd)
    expect(result.error).toBe('No file selected.')
  })

  test('returns error for non-PDF files', async () => {
    const result = await uploadResume(makeFormData(makeFile({ name: 'doc.docx', type: 'application/msword' })))
    expect(result.error).toBe('Only PDF files are allowed.')
  })

  test('returns error when file exceeds 5 MB', async () => {
    const bigFile = makeFile({ size: 6 * 1024 * 1024 })
    const result = await uploadResume(makeFormData(bigFile))
    expect(result.error).toBe('File size must be under 5 MB.')
  })

  test('returns error when version name is missing', async () => {
    const fd = new FormData()
    fd.set('file', makeFile())
    fd.set('version_name', '   ')
    const result = await uploadResume(fd)
    expect(result.error).toBe('Version name is required.')
  })

  test('uploads PDF and inserts resume row on success', async () => {
    const { mockClient, upload, insert } = makeSupabaseMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await uploadResume(makeFormData(makeFile()))

    expect(result.error).toBeUndefined()
    expect(upload).toHaveBeenCalled()
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id:      'user-1',
      version_name: 'v1',
    }))
  })

  test('removes uploaded file if DB insert fails', async () => {
    const { mockClient, remove } = makeSupabaseMock()
    mockClient.from = vi.fn().mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: 'db error' } }) })
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await uploadResume(makeFormData(makeFile()))

    expect(result.error).toBe('db error')
    expect(remove).toHaveBeenCalled()
  })

  test('accepts file exactly at 5 MB boundary', async () => {
    const { mockClient } = makeSupabaseMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const exactFile = makeFile({ size: 5 * 1024 * 1024 })
    const result = await uploadResume(makeFormData(exactFile))

    expect(result.error).toBeUndefined()
  })
})

// ── applyToRole ───────────────────────────────────────────────────────────────

describe('applyToRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
  })

  test('rejects non-learner users', async () => {
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    await expect(applyToRole('role-1', null)).rejects.toThrow('NEXT_REDIRECT')
  })

  test('returns error when application already exists', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-app' } })
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) }),
        }),
      }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await applyToRole('role-1', null)
    expect(result.error).toBe('You have already applied to this role.')
  })

  test('inserts application with user_id and role_id on success', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    // First call: check existing application (returns null = no duplicate)
    // Second call: get learner domain id (returns null = no record)
    // Third call: insert application
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // existing application check
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
              }),
            }),
          }
        }
        if (callCount === 2) {
          // learner domain id lookup
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
            }),
          }
        }
        // insert application
        return { insert: mockInsert }
      }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await applyToRole('role-1', 'https://example.com/resume.pdf')

    expect(result.error).toBeUndefined()
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      role_id:    'role-1',
      user_id:    'user-1',
      status:     'applied',
      resume_url: 'https://example.com/resume.pdf',
    }))
  })

  test('returns error when insert fails', async () => {
    let callCount = 0
    const mockClient = {
      from: vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
              }),
            }),
          }
        }
        if (callCount === 2) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
            }),
          }
        }
        return { insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }) }
      }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await applyToRole('role-1', null)
    expect(result.error).toBe('insert failed')
  })
})

// ── markNotInterested ─────────────────────────────────────────────────────────

describe('markNotInterested', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
  })

  test('rejects non-learner users', async () => {
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    await expect(markNotInterested('role-1')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('upserts role_preference with not_interested and reasons', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null })
    const mockClient = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await markNotInterested('role-1', ['Not relevant', 'Too far'])

    expect(result.error).toBeUndefined()
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id:    'user-1',
        role_id:    'role-1',
        preference: 'not_interested',
        reasons:    ['Not relevant', 'Too far'],
      }),
      expect.any(Object),
    )
  })

  test('returns error when upsert fails', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'upsert error' } }),
      }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await markNotInterested('role-1')
    expect(result.error).toBe('upsert error')
  })
})

// ── removeNotInterested ───────────────────────────────────────────────────────

describe('removeNotInterested', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
  })

  test('rejects non-learner users', async () => {
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    await expect(removeNotInterested('role-1')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('deletes the preference row scoped to current user', async () => {
    const mockEq2 = vi.fn().mockResolvedValue({ error: null })
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockClient = {
      from: vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEq1 }) }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await removeNotInterested('role-1')

    expect(result.error).toBeUndefined()
    expect(mockEq1).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockEq2).toHaveBeenCalledWith('role_id', 'role-1')
  })

  test('returns error when delete fails', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: 'delete error' } }),
          }),
        }),
      }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await removeNotInterested('role-1')
    expect(result.error).toBe('delete error')
  })
})

// ── deleteResume ──────────────────────────────────────────────────────────────

describe('deleteResume', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAppUser).mockResolvedValue(learnerUser)
  })

  test('rejects non-learner users', async () => {
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    await expect(deleteResume('res-1', 'https://example.com/storage/v1/object/public/resumes/user-1/file.pdf')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('removes file from storage and deletes DB row', async () => {
    const mockRemove = vi.fn().mockResolvedValue({ error: null })
    const mockEq2    = vi.fn().mockResolvedValue({ error: null })
    const mockEq1    = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockClient = {
      storage: { from: vi.fn().mockReturnValue({ remove: mockRemove }) },
      from: vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEq1 }) }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await deleteResume('res-1', 'https://example.com/storage/v1/object/public/resumes/user-1/file.pdf')

    expect(result.error).toBeUndefined()
    expect(mockRemove).toHaveBeenCalledWith(['user-1/file.pdf'])
    expect(mockEq1).toHaveBeenCalledWith('id', 'res-1')
    expect(mockEq2).toHaveBeenCalledWith('user_id', 'user-1')
  })

  test('still deletes DB row even if storage path cannot be parsed', async () => {
    const mockRemove = vi.fn()
    const mockEq2    = vi.fn().mockResolvedValue({ error: null })
    const mockEq1    = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockClient = {
      storage: { from: vi.fn().mockReturnValue({ remove: mockRemove }) },
      from: vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEq1 }) }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    // URL without the expected path segment — storage removal is skipped
    const result = await deleteResume('res-1', 'https://example.com/other-path/file.pdf')

    expect(result.error).toBeUndefined()
    expect(mockRemove).not.toHaveBeenCalled()
    expect(mockEq1).toHaveBeenCalledWith('id', 'res-1')
  })

  test('returns error when DB delete fails', async () => {
    const mockEq2    = vi.fn().mockResolvedValue({ error: { message: 'delete failed' } })
    const mockEq1    = vi.fn().mockReturnValue({ eq: mockEq2 })
    const mockClient = {
      storage: { from: vi.fn().mockReturnValue({ remove: vi.fn().mockResolvedValue({}) }) },
      from: vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: mockEq1 }) }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const result = await deleteResume('res-1', 'https://example.com/storage/v1/object/public/resumes/user-1/file.pdf')
    expect(result.error).toBe('delete failed')
  })
})
