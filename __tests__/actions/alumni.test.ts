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
import { revalidatePath }             from 'next/cache'
import { updateAlumniRow }            from '@/app/(protected)/alumni/actions'

const adminUser = { id: 'admin-1', role: 'admin' as const, name: 'Admin', email: 'admin@test.com' }

describe('updateAlumniRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
  })

  test('redirects when caller is not authorized', async () => {
    vi.mocked(requireStaff).mockImplementationOnce(() => {
      redirect('/dashboard')
      return Promise.resolve(adminUser)
    })
    await expect(
      updateAlumniRow('alumni-1', { employment_status: 'employed', placed_fy: null, company: null, role: null, salary: null, starting_salary: null })
    ).rejects.toThrow('NEXT_REDIRECT:/dashboard')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  test('updates alumni employment_status and placed_fy', async () => {
    const mockEqUpdate  = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate    = vi.fn().mockReturnValue({ eq: mockEqUpdate })
    const mockEqDelete  = vi.fn().mockResolvedValue({ error: null })
    const mockDelete    = vi.fn().mockReturnValue({ eq: mockEqDelete })
    const mockInsert    = vi.fn().mockResolvedValue({ error: null })
    const mockFrom      = vi.fn().mockReturnValue({ update: mockUpdate, delete: mockDelete, insert: mockInsert })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: mockFrom } as any)

    await updateAlumniRow('alumni-1', {
      employment_status: 'unemployed',
      placed_fy:         '2024-25',
      company:           null,
      role:              null,
      salary:            null, starting_salary:   null,
    })

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      employment_status: 'unemployed',
      placed_fy:         '2024-25',
    }))
    expect(mockEqUpdate).toHaveBeenCalledWith('id', 'alumni-1')
  })

  test('replaces current job when company and role are provided', async () => {
    const mockEqUpdate   = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate     = vi.fn().mockReturnValue({ eq: mockEqUpdate })
    const mockEqDelete2  = vi.fn().mockResolvedValue({ error: null })
    const mockEqDelete1  = vi.fn().mockReturnValue({ eq: mockEqDelete2 })
    const mockDelete     = vi.fn().mockReturnValue({ eq: mockEqDelete1 })
    const mockInsert     = vi.fn().mockResolvedValue({ error: null })
    const mockFrom       = vi.fn().mockReturnValue({ update: mockUpdate, delete: mockDelete, insert: mockInsert })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: mockFrom } as any)

    await updateAlumniRow('alumni-1', {
      employment_status: 'employed',
      placed_fy:         '2025-26',
      company:           'Acme Corp',
      role:              'Engineer',
      salary:            8.5, starting_salary:   null,
    })

    expect(mockDelete).toHaveBeenCalled()
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      alumni_id:  'alumni-1',
      company:    'Acme Corp',
      role:       'Engineer',
      salary:     8.5,
      is_current: true,
    }))
  })

  test('skips job replacement when company or role is missing', async () => {
    const mockEqUpdate = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate   = vi.fn().mockReturnValue({ eq: mockEqUpdate })
    const mockDelete   = vi.fn()
    const mockInsert   = vi.fn()
    const mockFrom     = vi.fn().mockReturnValue({ update: mockUpdate, delete: mockDelete, insert: mockInsert })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: mockFrom } as any)

    await updateAlumniRow('alumni-1', {
      employment_status: 'unemployed',
      placed_fy:         null,
      company:           null,
      role:              null,
      salary:            null, starting_salary:   null,
    })

    expect(mockDelete).not.toHaveBeenCalled()
    expect(mockInsert).not.toHaveBeenCalled()
  })

  test('calls revalidatePath for /alumni', async () => {
    const mockEqUpdate = vi.fn().mockResolvedValue({ error: null })
    const mockUpdate   = vi.fn().mockReturnValue({ eq: mockEqUpdate })
    const mockFrom     = vi.fn().mockReturnValue({ update: mockUpdate })
    vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: mockFrom } as any)

    await updateAlumniRow('alumni-1', {
      employment_status: 'employed',
      placed_fy:         null,
      company:           null,
      role:              null,
      salary:            null, starting_salary:   null,
    })

    expect(revalidatePath).toHaveBeenCalledWith('/alumni')
  })
})
