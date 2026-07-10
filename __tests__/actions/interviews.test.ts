import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { requireInterviewer } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { publishSlot } from '@/app/interviewer/actions'
import { bookSlot } from '@/app/candidate/interview/actions'

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

describe('publishSlot', () => {
  test('redirects a non-interviewer', async () => {
    vi.mocked(requireInterviewer).mockRejectedValue(new Error('NEXT_REDIRECT:/login'))
    await expect(publishSlot({ startsAt: '2030-01-01T10:00:00Z', endsAt: '2030-01-01T11:00:00Z' })).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects a slot in the past (validation before insert)', async () => {
    vi.mocked(requireInterviewer).mockResolvedValue({ id: 'u1', email: 'iv@x.com', name: 'IV', role: 'interviewer' })
    // existing-slots query returns none
    const q = { select: vi.fn(() => q), eq: vi.fn(() => q), neq: vi.fn(() => Promise.resolve({ data: [] })) }
    vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
    const res = await publishSlot({ startsAt: '2000-01-01T10:00:00Z', endsAt: '2000-01-01T11:00:00Z' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('future') })
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
