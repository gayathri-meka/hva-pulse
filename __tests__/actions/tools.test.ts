import { describe, test, expect, vi, beforeEach } from 'vitest'
import { requireStaff } from '@/lib/auth'
import {
  inspectScorecard,
  generateScorecard,
  testScorecard,
} from '@/app/(protected)/tools/actions'

vi.mock('@/lib/auth', () => ({ requireStaff: vi.fn() }))

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

const staffUser = { id: 's1', email: 's@x.com', name: 'Staff', role: 'staff' as const }
const text = (s: string) => ({ content: [{ type: 'text', text: s }] })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  vi.mocked(requireStaff).mockResolvedValue(staffUser)
})

describe('inspectScorecard', () => {
  test('rejects a non-staff caller', async () => {
    vi.mocked(requireStaff).mockRejectedValue(new Error('NEXT_REDIRECT:/dashboard'))
    await expect(inspectScorecard({ question: '', scorecard: 'x' })).rejects.toThrow('NEXT_REDIRECT')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('validates an empty scorecard before calling the model', async () => {
    const res = await inspectScorecard({ question: 'q', scorecard: '   ' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Paste a scorecard') })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('parses + normalizes a valid model response', async () => {
    mockCreate.mockResolvedValue(
      text('```json\n{"score": 120, "verdict": "Ready", "summary": "ok", "dimensions": [], "issues": []}\n```'),
    )
    const res = await inspectScorecard({ question: '', scorecard: 'Check whether the answer names two causes.' })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data.score).toBe(100) // clamped
      expect(res.data.dimensions).toHaveLength(6) // forced full set
    }
  })

  test('surfaces a friendly error when the model returns junk', async () => {
    mockCreate.mockResolvedValue(text('not json'))
    const res = await inspectScorecard({ question: '', scorecard: 'x' })
    expect(res.ok).toBe(false)
  })
})

describe('generateScorecard', () => {
  test('requires a question and an expectation', async () => {
    const res = await generateScorecard({ question: 'q only', expectation: '', examples: '' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('question and what') })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  test('returns the generated scorecard text', async () => {
    mockCreate.mockResolvedValue(text('  Check whether the answer defines inflation.\n4 — ...\n'))
    const res = await generateScorecard({ question: 'Define inflation', expectation: 'grade correctness', examples: '' })
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.data).toBe('Check whether the answer defines inflation.\n4 — ...')
  })
})

describe('testScorecard', () => {
  test('grades three times and returns all runs', async () => {
    mockCreate.mockResolvedValue(text('{"score":"4","scale":"1-4","feedback":"Great","reasoning":"top level"}'))
    const res = await testScorecard({ question: 'q', scorecard: 'sc', answer: 'ans' })
    expect(res.ok).toBe(true)
    if (res.ok) {
      expect(res.data).toHaveLength(3)
      expect(res.data[0]).toMatchObject({ score: '4', scale: '1-4', feedback: 'Great' })
    }
    expect(mockCreate).toHaveBeenCalledTimes(3)
  })

  test('validates missing answer', async () => {
    const res = await testScorecard({ question: 'q', scorecard: 'sc', answer: '' })
    expect(res).toEqual({ ok: false, error: expect.stringContaining('sample answer') })
  })
})
