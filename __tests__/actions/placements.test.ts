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

import { redirect }                   from 'next/navigation'
import { requireStaff }               from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  updateApplicationStatus,
  bulkUpdateApplicationStatus,
  createCompany,
  deleteCompany,
  deleteRole,
  deleteApplication,
} from '@/app/(protected)/placements/actions'

const adminUser = { id: 'admin-1', role: 'admin' as const, name: 'Admin', email: 'admin@test.com' }

function makeUpdateMock() {
  const mockEq     = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
  const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) }
  return { mockClient, mockUpdate, mockEq }
}

function makeDeleteMock() {
  const mockEq     = vi.fn().mockResolvedValue({ error: null })
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEq })
  const mockClient = { from: vi.fn().mockReturnValue({ delete: mockDelete }) }
  return { mockClient, mockDelete, mockEq }
}

// ── updateApplicationStatus ───────────────────────────────────────────────────

describe('updateApplicationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when caller is not admin or LF', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser)
    })
    await expect(updateApplicationStatus('app-1', 'shortlisted')).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  test('sets not_shortlisted_reason and clears rejection_feedback', async () => {
    const { mockClient, mockUpdate } = makeUpdateMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'not_shortlisted', 'Stronger candidates selected')

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status:                  'not_shortlisted',
      not_shortlisted_reason:  'Stronger candidates selected',
      not_shortlisted_reasons: [],
      rejection_feedback:      null,
      rejection_reasons:       [],
    }))
  })

  test('sets rejection_feedback and clears not_shortlisted_reason', async () => {
    const { mockClient, mockUpdate } = makeUpdateMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'rejected', 'Needs more experience')

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status:                  'rejected',
      rejection_feedback:      'Needs more experience',
      rejection_reasons:       [],
      not_shortlisted_reason:  null,
      not_shortlisted_reasons: [],
    }))
  })

  test('clears both note fields for any other status', async () => {
    const { mockClient, mockUpdate } = makeUpdateMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'shortlisted')

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status:                  'shortlisted',
      not_shortlisted_reason:  null,
      not_shortlisted_reasons: [],
      rejection_feedback:      null,
      rejection_reasons:       [],
    }))
  })

  test('passes reasons array through to update', async () => {
    const { mockClient, mockUpdate } = makeUpdateMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'not_shortlisted', 'See notes', ['Skill Mismatch', 'Location Mismatch'])

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status:                  'not_shortlisted',
      not_shortlisted_reasons: ['Skill Mismatch', 'Location Mismatch'],
      not_shortlisted_reason:  'See notes',
    }))
  })

  test('sets TAT timestamp for shortlisting decision', async () => {
    const { mockClient, mockUpdate } = makeUpdateMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'shortlisted')

    const call = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(typeof call.shortlisting_decision_taken_at).toBe('string')
  })

  test('sets TAT timestamp for hiring decision', async () => {
    // hired path also selects the application + related data for alumni upsert
    const mockSingle  = vi.fn().mockResolvedValue({ data: null })
    const mockEqSel   = vi.fn().mockReturnValue({ single: mockSingle })
    const mockSelect  = vi.fn().mockReturnValue({ eq: mockEqSel })
    const mockEqUpd   = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate  = vi.fn().mockReturnValue({ eq: mockEqUpd })
    const mockClient  = { from: vi.fn().mockReturnValue({ update: mockUpdate, select: mockSelect }) }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'hired')

    const call = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(typeof call.hiring_decision_taken_at).toBe('string')
  })

  test('note defaults to null when not provided for not_shortlisted', async () => {
    const { mockClient, mockUpdate } = makeUpdateMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await updateApplicationStatus('app-1', 'not_shortlisted')

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ not_shortlisted_reason: null }))
  })
})

// ── bulkUpdateApplicationStatus ───────────────────────────────────────────────

describe('bulkUpdateApplicationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when not authorised', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser)
    })
    await expect(bulkUpdateApplicationStatus(['a', 'b'], 'shortlisted')).rejects.toThrow()
  })

  test('updates multiple rows using .in()', async () => {
    const mockIn     = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn })
    const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await bulkUpdateApplicationStatus(['app-1', 'app-2'], 'shortlisted')

    expect(mockIn).toHaveBeenCalledWith('id', ['app-1', 'app-2'])
  })

  test('applies same status logic as single update — not_shortlisted clears rejection fields', async () => {
    const mockIn     = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn })
    const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await bulkUpdateApplicationStatus(['app-1'], 'not_shortlisted', 'note', ['Skill Mismatch'])

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status:                  'not_shortlisted',
      not_shortlisted_reason:  'note',
      not_shortlisted_reasons: ['Skill Mismatch'],
      rejection_feedback:      null,
      rejection_reasons:       [],
    }))
  })

  test('sets TAT timestamp for not_shortlisted', async () => {
    const mockIn     = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn })
    const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await bulkUpdateApplicationStatus(['app-1'], 'not_shortlisted')

    const call = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(typeof call.shortlisting_decision_taken_at).toBe('string')
  })

  test('throws on supabase error', async () => {
    const mockIn     = vi.fn().mockResolvedValue({ error: { message: 'bulk error' } })
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn })
    const mockClient = { from: vi.fn().mockReturnValue({ update: mockUpdate }) }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await expect(bulkUpdateApplicationStatus(['app-1'], 'shortlisted')).rejects.toThrow('bulk error')
  })
})

// ── createCompany ─────────────────────────────────────────────────────────────

describe('createCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when not authorised', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser)
    })
    const fd = new FormData()
    fd.set('company_name', 'Acme')
    await expect(createCompany(fd)).rejects.toThrow()
  })

  test('inserts company when no existing companies', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn().mockResolvedValue({ data: [] }),
            insert: mockInsert,
          }
        }
        return {}
      }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const fd = new FormData()
    fd.set('company_name', 'Acme Corp')
    await createCompany(fd)

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      company_name: 'Acme Corp',
      sort_order:   0,
    }))
  })

  test('shifts existing companies down before inserting', async () => {
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const mockInsert = vi.fn().mockResolvedValue({ error: null })
    const mockClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn().mockResolvedValue({ data: [{ id: 'co-1', sort_order: 0 }] }),
            update: mockUpdate,
            insert: mockInsert,
          }
        }
        return {}
      }),
    }
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    const fd = new FormData()
    fd.set('company_name', 'New Co')
    await createCompany(fd)

    expect(mockUpdate).toHaveBeenCalledWith({ sort_order: 1 })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ sort_order: 0 }))
  })
})

// ── deleteCompany ─────────────────────────────────────────────────────────────

describe('deleteCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when not authorised', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser)
    })
    await expect(deleteCompany('co-1')).rejects.toThrow()
  })

  test('deletes company by id', async () => {
    const { mockClient, mockEq } = makeDeleteMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await deleteCompany('co-1')

    expect(mockEq).toHaveBeenCalledWith('id', 'co-1')
  })
})

// ── deleteRole ────────────────────────────────────────────────────────────────

describe('deleteRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when not authorised', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser)
    })
    await expect(deleteRole('role-1')).rejects.toThrow()
  })

  test('deletes role by id', async () => {
    const { mockClient, mockEq } = makeDeleteMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await deleteRole('role-1')

    expect(mockEq).toHaveBeenCalledWith('id', 'role-1')
  })
})

// ── deleteApplication ─────────────────────────────────────────────────────────

describe('deleteApplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when not authorised', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser)
    })
    await expect(deleteApplication('app-1')).rejects.toThrow()
  })

  test('deletes application by id', async () => {
    const { mockClient, mockEq } = makeDeleteMock()
    vi.mocked(createServerSupabaseClient).mockResolvedValue(mockClient as any)

    await deleteApplication('app-1')

    expect(mockEq).toHaveBeenCalledWith('id', 'app-1')
  })
})
