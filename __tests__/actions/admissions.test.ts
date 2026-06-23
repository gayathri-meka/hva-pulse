import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireStaff: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

import { revalidatePath } from 'next/cache'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { addProspectComment, deleteProspectComment } from '@/app/(protected)/admissions/actions'

const adminUser = { id: 'admin-1', role: 'admin' as const, name: 'Admin', email: 'admin@test.com' }
const staffUser = { id: 'staff-1', role: 'staff' as const, name: 'Staff', email: 'staff@test.com' }

// Mock client for the insert().select().single() chain used by addProspectComment.
function mockInsertClient(result: { data?: unknown; error?: { message: string } | null }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  const client = { from: vi.fn().mockReturnValue({ insert }) }
  return { client, insert }
}

// Mock client for the delete().eq()[.eq()] chain (chainable + awaitable).
function mockDeleteClient(result: { error: { message: string } | null }) {
  const q: any = {}
  q.delete = vi.fn(() => q)
  q.eq = vi.fn(() => q)
  q.then = (resolve: (v: unknown) => void) => resolve(result)
  const client = { from: vi.fn(() => q) }
  return { client, q }
}

describe('addProspectComment', () => {
  beforeEach(() => vi.clearAllMocks())

  test('rejects when caller is not staff (requireStaff redirects)', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(addProspectComment('a@x.com', 'hi')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects rows without an email', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    expect(await addProspectComment('', 'hi')).toEqual({ ok: false, error: expect.stringContaining('no email') })
  })

  test('rejects an empty comment', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    expect(await addProspectComment('a@x.com', '   ')).toEqual({ ok: false, error: 'Comment is empty.' })
  })

  test('rejects an over-long comment', async () => {
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    const res = await addProspectComment('a@x.com', 'x'.repeat(5001))
    expect(res).toEqual({ ok: false, error: expect.stringContaining('too long') })
  })

  test('inserts normalised email + author and returns the new comment', async () => {
    const created = {
      id: 'c1',
      email: 'a@x.com',
      body: 'struggled with sensai login',
      author_id: 'staff-1',
      author_name: 'Staff',
      created_at: '2026-06-23T00:00:00Z',
    }
    const { client, insert } = mockInsertClient({ data: created, error: null })
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    vi.mocked(createClient).mockReturnValue(client as any)

    const res = await addProspectComment('  A@X.com ', '  struggled with sensai login  ')

    expect(res).toEqual({ ok: true, comment: created })
    expect(insert).toHaveBeenCalledWith({
      email: 'a@x.com', // normalised
      body: 'struggled with sensai login', // trimmed
      author_id: 'staff-1',
      author_name: 'Staff',
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admissions/prospects')
    expect(revalidatePath).toHaveBeenCalledWith('/admissions/learner-applications')
  })

  test('surfaces a Supabase error and does not revalidate', async () => {
    const { client } = mockInsertClient({ data: null, error: { message: 'relation does not exist' } })
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    vi.mocked(createClient).mockReturnValue(client as any)

    const res = await addProspectComment('a@x.com', 'hi')

    expect(res).toEqual({ ok: false, error: 'relation does not exist' })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('deleteProspectComment', () => {
  beforeEach(() => vi.clearAllMocks())

  test('rejects when caller is not staff', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(deleteProspectComment('c1')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('admin can delete any comment (no author filter)', async () => {
    const { client, q } = mockDeleteClient({ error: null })
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    vi.mocked(createClient).mockReturnValue(client as any)

    const res = await deleteProspectComment('c1')

    expect(res).toEqual({ ok: true })
    expect(q.eq).toHaveBeenCalledTimes(1)
    expect(q.eq).toHaveBeenCalledWith('id', 'c1')
  })

  test('non-admin can only delete their own comment (author filter added)', async () => {
    const { client, q } = mockDeleteClient({ error: null })
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    vi.mocked(createClient).mockReturnValue(client as any)

    const res = await deleteProspectComment('c1')

    expect(res).toEqual({ ok: true })
    expect(q.eq).toHaveBeenCalledTimes(2)
    expect(q.eq).toHaveBeenNthCalledWith(1, 'id', 'c1')
    expect(q.eq).toHaveBeenNthCalledWith(2, 'author_id', 'staff-1')
  })

  test('surfaces a Supabase error', async () => {
    const { client } = mockDeleteClient({ error: { message: 'delete failed' } })
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
    vi.mocked(createClient).mockReturnValue(client as any)

    expect(await deleteProspectComment('c1')).toEqual({ ok: false, error: 'delete failed' })
  })
})
