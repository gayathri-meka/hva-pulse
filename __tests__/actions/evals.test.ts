import { describe, test, expect, vi, beforeEach } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/auth'
import { setGradingEval } from '@/app/(protected)/admissions/challenge/evals'

vi.mock('@/lib/auth', () => ({ requireStaff: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))

const staffUser = { id: 's1', email: 'staff@x.com', name: 'Staff', role: 'staff' as const }

// from().upsert().select().single() → resolves { data, error }
function mockUpsertClient(result: { data?: unknown; error: { message: string } | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {}
  q.upsert = vi.fn(() => q)
  q.select = vi.fn(() => q)
  q.single = vi.fn(() => Promise.resolve(result))
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => q) } as never)
  return q
}

const base = {
  context: 'screening',
  questionId: 'q1',
  learnerEmail: 'L@x.com',
  comment: 'x',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://x'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'key'
  vi.mocked(requireStaff).mockResolvedValue(staffUser)
})

describe('setGradingEval', () => {
  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(
      setGradingEval({ ...base, verdict: 'correct', symptoms: [] }),
    ).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects an incorrect verdict with no symptoms (before any DB write)', async () => {
    const q = mockUpsertClient({ data: null, error: null })
    const res = await setGradingEval({ ...base, verdict: 'incorrect', symptoms: [] })
    expect(res.ok).toBe(false)
    expect(q.upsert).not.toHaveBeenCalled()
  })

  test('clears symptoms on a correct verdict and stamps the reviewer', async () => {
    const q = mockUpsertClient({
      data: { question_id: 'q1', learner_email: 'l@x.com', verdict: 'correct', symptoms: [], comment: 'x', labeled_by_name: 'Staff', updated_at: 't' },
      error: null,
    })
    const res = await setGradingEval({ ...base, verdict: 'correct', symptoms: ['inaccurate_score'] })
    expect(res.ok).toBe(true)
    const row = q.upsert.mock.calls[0][0]
    expect(row.symptoms).toEqual([]) // cleared because verdict is correct
    expect(row.learner_email).toBe('l@x.com') // normalized
    expect(row.labeled_by).toBe('staff@x.com')
  })

  test('persists symptoms on an incorrect verdict', async () => {
    const q = mockUpsertClient({
      data: { question_id: 'q1', learner_email: 'l@x.com', verdict: 'incorrect', symptoms: ['vague_feedback'], comment: null, labeled_by_name: 'Staff', updated_at: 't' },
      error: null,
    })
    const res = await setGradingEval({ ...base, verdict: 'incorrect', symptoms: ['vague_feedback'] })
    expect(res.ok).toBe(true)
    expect(q.upsert.mock.calls[0][0].symptoms).toEqual(['vague_feedback'])
  })
})
