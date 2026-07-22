import { describe, test, expect } from 'vitest'
import {
  buildNotesReviewUserPrompt,
  parseNotesReview,
  isNotesOptional,
  type NotesReviewInput,
} from '@/lib/interviewNotesReview'

const baseInput: NotesReviewInput = {
  candidateName: 'Asha Rao',
  round: 1,
  questions: [
    { n: 1, section: 'Motivation', prompt: 'Why HVA?', note: 'Wants a career switch, specific about fintech.' },
    { n: 2, section: null, prompt: 'Tell us about a hard decision.', note: '' },
  ],
  rubrics: [
    {
      label: 'Drive',
      levels: [
        { score: 1, descriptor: 'low' },
        { score: 2, descriptor: 'some' },
        { score: 3, descriptor: 'good', lookingFor: 'concrete example' },
        { score: 4, descriptor: 'exceptional' },
      ],
      score: 4,
    },
  ],
  summary: 'Strong candidate.',
  recommendation: 'advance',
}

describe('buildNotesReviewUserPrompt', () => {
  test('includes candidate, round label, question prompts and notes', () => {
    const p = buildNotesReviewUserPrompt(baseInput)
    expect(p).toContain('Asha Rao')
    expect(p).toContain('Round 1 (Motivation)')
    expect(p).toContain('Q1 [Motivation]: Why HVA?')
    expect(p).toContain('Wants a career switch')
  })

  test('marks blank notes explicitly so the model sees the gap', () => {
    const p = buildNotesReviewUserPrompt(baseInput)
    expect(p).toContain('(no note written)')
  })

  test('renders rubric levels + the interviewer score', () => {
    const p = buildNotesReviewUserPrompt(baseInput)
    expect(p).toContain('Rubric "Drive" — interviewer\'s score: 4/4')
    expect(p).toContain('3: good')
    expect(p).toContain('Looking for: concrete example')
  })

  test('unscored rubric shows "not scored"', () => {
    const p = buildNotesReviewUserPrompt({
      ...baseInput,
      rubrics: [{ label: 'Drive', levels: [{ score: 1, descriptor: 'a' }, { score: 4, descriptor: 'd' }], score: null }],
    })
    expect(p).toContain('not scored')
  })

  test('handles no questions / no rubrics / no summary gracefully', () => {
    const p = buildNotesReviewUserPrompt({
      ...baseInput,
      questions: [],
      rubrics: [],
      summary: '',
      recommendation: null,
    })
    expect(p).toContain('(no questions configured)')
    expect(p).toContain('(no rubrics configured)')
    expect(p).toContain('(no summary written)')
    expect(p).toContain('(no recommendation yet)')
  })

  test('round 2 gets the Coding label', () => {
    expect(buildNotesReviewUserPrompt({ ...baseInput, round: 2 })).toContain('Round 2 (Coding)')
  })

  test('marks notes-optional questions so the model skips them as gaps', () => {
    const p = buildNotesReviewUserPrompt({
      ...baseInput,
      questions: [{ n: 1, section: 'General', prompt: 'Before we begin…', note: '', notesOptional: true }],
    })
    expect(p).toContain('(notes optional)')
  })

  test('does not add the optional marker to normal questions', () => {
    expect(buildNotesReviewUserPrompt(baseInput)).not.toContain('(notes optional)')
  })
})

describe('isNotesOptional', () => {
  test('flags the warm-up opener', () => {
    expect(isNotesOptional('Before we begin, this is just a simple conversation to get to know you better.')).toBe(true)
  })
  test('is case-insensitive and tolerant of surrounding text', () => {
    expect(isNotesOptional('  BEFORE WE BEGIN — your goals?  ')).toBe(true)
  })
  test('does not flag a normal scored question', () => {
    expect(isNotesOptional('Tell us about a hard decision you made.')).toBe(false)
  })
  test('handles empty/undefined prompts', () => {
    expect(isNotesOptional('')).toBe(false)
  })
})

describe('parseNotesReview', () => {
  const good = JSON.stringify({
    quality: 'thin',
    overall: 'Notes are sparse.',
    questionGaps: [{ question: 'Tell us about a hard decision.', issue: 'No note captured.' }],
    ratingChecks: [
      { rubric: 'Drive', givenScore: 4, suggestedScore: 2, aligned: false, rationale: 'Only Q1 has evidence.' },
    ],
  })

  test('parses a well-formed response', () => {
    const r = parseNotesReview(good)
    expect(r.quality).toBe('thin')
    expect(r.overall).toBe('Notes are sparse.')
    expect(r.questionGaps).toHaveLength(1)
    expect(r.ratingChecks[0]).toMatchObject({ rubric: 'Drive', givenScore: 4, suggestedScore: 2, aligned: false })
  })

  test('strips ```json fences', () => {
    const r = parseNotesReview('```json\n' + good + '\n```')
    expect(r.quality).toBe('thin')
  })

  test('defaults unknown quality to adequate', () => {
    const r = parseNotesReview(JSON.stringify({ quality: 'excellent', overall: 'x' }))
    expect(r.quality).toBe('adequate')
  })

  test('clamps out-of-range scores to null', () => {
    const r = parseNotesReview(
      JSON.stringify({ ratingChecks: [{ rubric: 'A', givenScore: 9, suggestedScore: 0, aligned: false, rationale: 'r' }] }),
    )
    expect(r.ratingChecks[0].givenScore).toBeNull()
    expect(r.ratingChecks[0].suggestedScore).toBeNull()
  })

  test('rounds fractional scores', () => {
    const r = parseNotesReview(JSON.stringify({ ratingChecks: [{ rubric: 'A', givenScore: 3.4, aligned: true, rationale: 'r' }] }))
    expect(r.ratingChecks[0].givenScore).toBe(3)
  })

  test('drops gaps with no issue and checks with no rubric', () => {
    const r = parseNotesReview(
      JSON.stringify({
        questionGaps: [{ question: 'Q1', issue: '' }, { question: 'Q2', issue: 'thin' }],
        ratingChecks: [{ rubric: '', rationale: 'x' }, { rubric: 'B', aligned: true, rationale: 'ok' }],
      }),
    )
    expect(r.questionGaps).toHaveLength(1)
    expect(r.questionGaps[0].question).toBe('Q2')
    expect(r.ratingChecks).toHaveLength(1)
    expect(r.ratingChecks[0].rubric).toBe('B')
  })

  test('aligned is strictly boolean true', () => {
    const r = parseNotesReview(JSON.stringify({ ratingChecks: [{ rubric: 'A', aligned: 'yes', rationale: 'r' }] }))
    expect(r.ratingChecks[0].aligned).toBe(false)
  })

  test('missing arrays default to empty', () => {
    const r = parseNotesReview(JSON.stringify({ quality: 'strong', overall: 'good' }))
    expect(r.questionGaps).toEqual([])
    expect(r.ratingChecks).toEqual([])
  })

  test('throws on non-JSON', () => {
    expect(() => parseNotesReview('not json at all')).toThrow('valid JSON')
  })
})
