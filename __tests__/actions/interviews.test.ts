import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { requireInterviewer, getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  setInterviewOutcome,
  addInterviewer,
  setInterviewerRound,
  syncWeekAvailability,
} from '@/app/(protected)/admissions/interviews/actions'
import { bookSlot, cancelMyInterview, getBookingState } from '@/app/candidate/interview/actions'

vi.mock('@/lib/auth', () => ({ requireInterviewer: vi.fn(), requireStaff: vi.fn(), getAppUser: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/interviewInvite', () => ({ sendBookingEmails: vi.fn().mockResolvedValue({ sent: true }) }))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
})

describe('setInterviewOutcome', () => {
  test('redirects a non-interviewer', async () => {
    vi.mocked(requireInterviewer).mockRejectedValue(new Error('NEXT_REDIRECT:/login'))
    await expect(setInterviewOutcome('iv-1', 'completed')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('only closes an interviewer’s own open/confirmed interview', async () => {
    vi.mocked(requireInterviewer).mockResolvedValue({ id: 'u1', email: 'iv@x.com', name: 'IV', role: 'interviewer' })
    const q = { update: vi.fn(() => q), eq: vi.fn(() => q), in: vi.fn(() => q), select: vi.fn(() => Promise.resolve({ data: [], error: null })) }
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
    const res = await setInterviewOutcome('iv-1', 'no_show')
    expect(res).toEqual({ ok: false, error: expect.stringContaining('not found') })
    expect(q.in).toHaveBeenCalledWith('status', ['booked', 'confirmed'])
  })
})

describe('bookSlot', () => {
  function authEmail(email: string | null) {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: email ? { email } : null } }) },
    } as never)
  }

  test('asks an unauthenticated user to sign in', async () => {
    authEmail(null)
    const res = await bookSlot('slot-1')
    expect(res).toEqual({ ok: false, error: expect.stringContaining('sign in') })
  })

  test('blocks a candidate who is not selected+released', async () => {
    authEmail('cand@x.com')
    // challenge_decisions lookup → not published
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: vi.fn(() => Promise.resolve({ data: { final_decision: 'selected', published_at: null } })) }
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
    const res = await bookSlot('slot-1')
    expect(res).toEqual({ ok: false, error: expect.stringContaining('not eligible') })
  })
})

describe('addInterviewer (round specialisation)', () => {
  const adminUser = { id: 'a', email: 'admin@x.com', name: 'A', role: 'admin' as const }

  test('rejects a non-admin', async () => {
    vi.mocked(getAppUser).mockResolvedValue({ id: 's', email: 's@x.com', name: 'S', role: 'staff' })
    expect(await addInterviewer({ email: 'i@x.com', name: 'I', round: 1 })).toEqual({ ok: false, error: expect.stringContaining('admins') })
  })

  test('rejects an invalid round', async () => {
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    expect(await addInterviewer({ email: 'i@x.com', name: 'I', round: 3 as unknown as 1 })).toEqual({ ok: false, error: expect.stringContaining('which round') })
  })

  test('inserts a new interviewer with their round', async () => {
    vi.mocked(getAppUser).mockResolvedValue(adminUser)
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    const q: Record<string, unknown> = {}
    q.select = vi.fn(() => q); q.eq = vi.fn(() => q); q.maybeSingle = vi.fn(() => Promise.resolve({ data: null })); q.insert = insert
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
    const res = await addInterviewer({ email: 'Coder@x.com', name: 'C', round: 2 })
    expect(res).toEqual({ ok: true })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ email: 'coder@x.com', role: 'interviewer', interview_round: 2 }))
  })
})

describe('setInterviewerRound', () => {
  test('rejects a non-admin', async () => {
    vi.mocked(getAppUser).mockResolvedValue({ id: 's', email: 's@x.com', name: 'S', role: 'staff' })
    expect(await setInterviewerRound({ email: 'i@x.com', round: 2 })).toEqual({ ok: false, error: expect.stringContaining('admins') })
  })

  test('updates the user round and re-tags their open slots', async () => {
    vi.mocked(getAppUser).mockResolvedValue({ id: 'a', email: 'admin@x.com', name: 'A', role: 'admin' })
    const usersUpdate = vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }))
    const slotsEq2 = vi.fn(() => Promise.resolve({ error: null }))
    const slotsUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ eq: slotsEq2 })) }))
    const from = vi.fn((t: string) => (t === 'users' ? { update: usersUpdate } : { update: slotsUpdate }))
    vi.mocked(createClient).mockReturnValue({ from } as never)
    const res = await setInterviewerRound({ email: 'iv@x.com', round: 2 })
    expect(res).toEqual({ ok: true })
    expect(usersUpdate).toHaveBeenCalledWith({ interview_round: 2 })
    expect(slotsUpdate).toHaveBeenCalledWith({ round: 2 })
  })
})

describe('syncWeekAvailability (round inheritance)', () => {
  test('blocks a dedicated interviewer with no round set', async () => {
    vi.mocked(requireInterviewer).mockResolvedValue({ id: 'u', email: 'iv@x.com', name: 'IV', role: 'interviewer' })
    const q: Record<string, unknown> = {}
    q.select = vi.fn(() => q); q.eq = vi.fn(() => q)
    q.maybeSingle = vi.fn(() => Promise.resolve({ data: { interview_round: null, role: 'interviewer' } }))
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
    const res = await syncWeekAvailability({ weekStartIso: '2030-08-01T00:00:00Z', starts: ['2030-08-01T10:00:00Z'] })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('interview round') })
  })

  test('stamps new slots with the interviewer’s round', async () => {
    vi.mocked(requireInterviewer).mockResolvedValue({ id: 'u', email: 'coder@x.com', name: 'C', role: 'interviewer' })
    const insert = vi.fn((_rows: unknown) => Promise.resolve({ error: null }))
    const users: Record<string, unknown> = {}
    users.select = vi.fn(() => users); users.eq = vi.fn(() => users)
    users.maybeSingle = vi.fn(() => Promise.resolve({ data: { interview_round: 2, role: 'interviewer' } }))
    const slots: Record<string, unknown> = {}
    slots.select = vi.fn(() => slots); slots.eq = vi.fn(() => slots); slots.gte = vi.fn(() => slots); slots.lt = vi.fn(() => slots)
    slots.then = (res: (v: unknown) => void) => res({ data: [] }) // existing slots = none
    slots.insert = insert
    const from = vi.fn((t: string) => (t === 'users' ? users : slots))
    vi.mocked(createClient).mockReturnValue({ from } as never)
    const res = await syncWeekAvailability({ weekStartIso: '2030-08-01T00:00:00Z', starts: ['2030-08-01T10:00:00Z'] })
    expect(res).toEqual({ ok: true })
    const inserted = insert.mock.calls[0][0] as unknown as Array<{ round: number }>
    expect(inserted[0].round).toBe(2)
  })
})

describe('getBookingState (round-scoped slot pool)', () => {
  function authEmail(email: string) {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email } } }) },
    } as never)
  }

  test('only offers slots for the round the candidate is on', async () => {
    authEmail('cand@x.com')
    const slotsEq = vi.fn()
    const from = vi.fn((t: string) => {
      if (t === 'challenge_decisions')
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { final_decision: 'selected', published_at: '2026-01-01' } })) })) })) }
      if (t === 'interviews')
        return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [] })) })) } // no interviews → nextRound = 1
      // interview_slots
      const b: Record<string, unknown> = {}
      b.select = vi.fn(() => b)
      b.eq = vi.fn((...args: unknown[]) => { slotsEq(...args); return b })
      b.gt = vi.fn(() => b)
      b.order = vi.fn(() => Promise.resolve({ data: [] }))
      return b
    })
    vi.mocked(createClient).mockReturnValue({ from } as never)
    const res = await getBookingState()
    expect(res.eligible).toBe(true)
    expect(res.nextRound).toBe(1)
    expect(slotsEq).toHaveBeenCalledWith('round', 1)
  })
})

describe('cancelMyInterview', () => {
  function authEmail(email: string | null) {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: email ? { email } : null } }) },
    } as never)
  }

  test('asks an unauthenticated user to sign in', async () => {
    authEmail(null)
    expect(await cancelMyInterview('iv-1')).toEqual({ ok: false, error: expect.stringContaining('sign in') })
  })

  test('refuses to change a completed interview', async () => {
    authEmail('cand@x.com')
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'iv-1', slot_id: 's1', status: 'completed', scheduled_at: '2030-01-01T00:00:00Z' } })) }
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
    expect(await cancelMyInterview('iv-1')).toEqual({ ok: false, error: expect.stringContaining('can no longer be changed') })
  })
})
