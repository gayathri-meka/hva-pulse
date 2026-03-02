import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
vi.mock('next/cache',      () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  getAppUser:   vi.fn(),
  requireStaff: vi.fn(),
}))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { redirect }                      from 'next/navigation'
import { requireStaff }                  from '@/lib/auth'
import { createServerSupabaseClient }    from '@/lib/supabase-server'
import { updateApplicationStatus }       from '@/app/(protected)/placements/actions'

const adminUser  = { id: 'admin-1',   role: 'admin'   as const, name: 'Admin',   email: 'admin@test.com' }

function makeSupabaseMock() {
  const mockEq     = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) }
  return { mockClient, mockUpdate, mockEq }
}

describe('updateApplicationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: auth passes (admin)
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when caller is not admin or LF', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser) // unreachable, satisfies type
    })
    await expect(updateApplicationStatus('app-1', 'shortlisted')).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  test('sets not_shortlisted_reason and clears rejection_feedback', async () => {
    const { mockClient, mockUpdate } = makeSupabaseMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'not_shortlisted', 'Stronger candidates selected')

    expect(mockUpdate).toHaveBeenCalledWith({
      status:                 'not_shortlisted',
      not_shortlisted_reason: 'Stronger candidates selected',
      rejection_feedback:     null,
    })
  })

  test('sets rejection_feedback and clears not_shortlisted_reason', async () => {
    const { mockClient, mockUpdate } = makeSupabaseMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'rejected', 'Needs more experience')

    expect(mockUpdate).toHaveBeenCalledWith({
      status:                 'rejected',
      rejection_feedback:     'Needs more experience',
      not_shortlisted_reason: null,
    })
  })

  test('clears both note fields for any other status', async () => {
    const { mockClient, mockUpdate } = makeSupabaseMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'shortlisted')

    expect(mockUpdate).toHaveBeenCalledWith({
      status:                 'shortlisted',
      not_shortlisted_reason: null,
      rejection_feedback:     null,
    })
  })

  test('note defaults to null when not provided for not_shortlisted', async () => {
    const { mockClient, mockUpdate } = makeSupabaseMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'not_shortlisted')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ not_shortlisted_reason: null }),
    )
  })
})
