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
import { uploadResume }             from '@/app/(learner)/learner/actions'

const learnerUser = { id: 'user-1', role: 'learner' as const, name: 'Test Learner', email: 'learner@test.com' }

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
    // Make the `from('resumes').insert` fail
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
