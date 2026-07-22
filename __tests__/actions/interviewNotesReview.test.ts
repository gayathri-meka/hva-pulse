import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ requireStaff: vi.fn(), requireInterviewer: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/openai', () => ({ chatJSON: vi.fn() }))

import { requireStaff } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { chatJSON } from '@/lib/openai'
import { reviewInterviewNotes } from '@/app/(protected)/admissions/interviews/cockpit-actions'

// A query builder that is chainable (select/eq/order), awaitable ({data}), and
// supports maybeSingle — resolving to the preset data for the requested table.
function makeClient(tableData: Record<string, unknown>) {
  const from = vi.fn((table: string) => {
    const data = tableData[table] ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {}
    b.select = vi.fn(() => b)
    b.eq = vi.fn(() => b)
    b.order = vi.fn(() => b)
    b.maybeSingle = vi.fn(async () => ({ data }))
    b.then = (resolve: (v: unknown) => void) => resolve({ data })
    return b
  })
  return { from }
}

const IV = { id: 'iv-1', candidate_email: 'asha@x.com', round: 1, summary: 'Strong.', recommendation: 'advance' }
const QUESTIONS = [
  { id: 'q1', round: 1, section: 'Motivation', ordering: 1, prompt: 'Why HVA?', active: true },
  { id: 'q2', round: null, section: null, ordering: 2, prompt: 'Hard decision?', active: true },
]
const RUBRICS = [{ key: 'drive', label: 'Drive', ordering: 1, level_1: 'low', level_2: 'some', level_3: 'good', level_4: 'great', active: true }]

const GOOD_JSON = JSON.stringify({
  quality: 'thin',
  overall: 'Sparse.',
  questionGaps: [{ question: 'Hard decision?', issue: 'No note.' }],
  ratingChecks: [{ rubric: 'Drive', givenScore: 4, suggestedScore: 2, aligned: false, rationale: 'Thin.' }],
})

function fullTables(overrides: Record<string, unknown> = {}) {
  return {
    interviews: IV,
    prospects: { name: 'Asha Rao' },
    interview_questions: QUESTIONS,
    interview_rubrics: RUBRICS,
    interview_notes: [{ question_id: 'q1', note: 'Career switch to fintech.' }],
    interview_scores: [{ rubric_key: 'drive', score: 4 }],
    ...overrides,
  }
}

describe('reviewInterviewNotes', () => {
  beforeEach(() => vi.clearAllMocks())

  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(reviewInterviewNotes('iv-1')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('errors when the interview is missing', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    vi.mocked(createClient).mockReturnValue(makeClient({ interviews: null }) as never)
    const r = await reviewInterviewNotes('nope')
    expect(r).toEqual({ ok: false, error: 'Interview not found.' })
    expect(chatJSON).not.toHaveBeenCalled()
  })

  test('errors when there is nothing to review', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    vi.mocked(createClient).mockReturnValue(
      makeClient(fullTables({ interviews: { ...IV, summary: '' }, interview_notes: [], interview_scores: [] })) as never,
    )
    const r = await reviewInterviewNotes('iv-1')
    expect(r).toEqual({ ok: false, error: 'No notes or scores to review yet.' })
    expect(chatJSON).not.toHaveBeenCalled()
  })

  test('success: calls the model with a prompt built from the notes and returns the parsed review', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    vi.mocked(createClient).mockReturnValue(makeClient(fullTables()) as never)
    vi.mocked(chatJSON).mockResolvedValue(GOOD_JSON)

    const r = await reviewInterviewNotes('iv-1')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data.quality).toBe('thin')
    expect(r.data.questionGaps).toHaveLength(1)
    expect(r.data.ratingChecks[0]).toMatchObject({ rubric: 'Drive', givenScore: 4, suggestedScore: 2, aligned: false })

    // The user prompt should carry the candidate + the rubric score the interviewer gave.
    const arg = vi.mocked(chatJSON).mock.calls[0][0]
    expect(arg.user).toContain('Asha Rao')
    expect(arg.user).toContain('Career switch to fintech.')
    expect(arg.user).toContain("interviewer's score: 4/4")
  })

  test('surfaces an OpenAI failure as an error result', async () => {
    vi.mocked(requireStaff).mockResolvedValue(undefined as never)
    vi.mocked(createClient).mockReturnValue(makeClient(fullTables()) as never)
    vi.mocked(chatJSON).mockRejectedValue(new Error('OpenAI is not configured — set OPENAI_API_KEY.'))
    const r = await reviewInterviewNotes('iv-1')
    expect(r).toEqual({ ok: false, error: 'OpenAI is not configured — set OPENAI_API_KEY.' })
  })
})
