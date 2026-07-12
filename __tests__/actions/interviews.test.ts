import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { requireInterviewer } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { setInterviewOutcome } from '@/app/(protected)/admissions/interviews/actions'
import { bookSlot, cancelMyInterview } from '@/app/candidate/interview/actions'

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
