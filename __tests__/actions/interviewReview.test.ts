import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireStaff: vi.fn(), getAppUser: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { requireStaff, getAppUser } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { setInterviewDecision } from '@/app/(protected)/admissions/interviews/review-actions'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
  vi.mocked(getAppUser).mockResolvedValue({ id: 's', email: 'staff@x.com', name: 'S', role: 'staff' })
})

// Client that serves interviews (list) + interview_decisions (maybeSingle) + upsert.
function client({ interviews, decision, upsertError }: { interviews: unknown[]; decision: unknown; upsertError?: { message: string } | null }) {
  const upsert = vi.fn(() => Promise.resolve({ error: upsertError ?? null }))
  const from = vi.fn((t: string) => {
    if (t === 'interviews') return { select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: interviews })) })) }
    if (t === 'interview_decisions')
      return {
        select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: decision })) })) })),
        upsert,
      }
    return {}
  })
  return { client: { from }, upsert }
}

describe('setInterviewDecision', () => {
  test('redirects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(setInterviewDecision({ email: 'c@x.com', gate: 'stage1', decision: 'advance' })).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects a decision that does not belong to the gate', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    vi.mocked(createClient).mockReturnValue(client({ interviews: [], decision: null }).client as never)
    const res = await setInterviewDecision({ email: 'c@x.com', gate: 'stage1', decision: 'selected' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Invalid decision') })
  })

  test('blocks releasing advance before Round 1 is done', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    const { client: c, upsert } = client({ interviews: [{ round: 1, status: 'booked', recommendation: null }], decision: null })
    vi.mocked(createClient).mockReturnValue(c as never)
    const res = await setInterviewDecision({ email: 'c@x.com', gate: 'stage1', decision: 'advance' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Round 1 must be completed') })
    expect(upsert).not.toHaveBeenCalled()
  })

  test('releases advance once Round 1 is completed', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    const { client: c, upsert } = client({ interviews: [{ round: 1, status: 'completed', recommendation: 'advance' }], decision: null })
    vi.mocked(createClient).mockReturnValue(c as never)
    const res = await setInterviewDecision({ email: 'c@x.com', gate: 'stage1', decision: 'advance' })
    expect(res).toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ candidate_email: 'c@x.com', stage1: 'advance', decided_by: 'staff@x.com' }),
      expect.objectContaining({ onConflict: 'candidate_email' }),
    )
  })

  test('blocks the final call until Round 2 is done after advancing', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    const { client: c } = client({ interviews: [{ round: 1, status: 'completed' }, { round: 2, status: 'booked' }], decision: { stage1: 'advance', final: null } })
    vi.mocked(createClient).mockReturnValue(c as never)
    const res = await setInterviewDecision({ email: 'c@x.com', gate: 'final', decision: 'selected' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Round 2 must be completed') })
  })
})
