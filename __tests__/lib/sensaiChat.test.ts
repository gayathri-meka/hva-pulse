import { describe, test, expect } from 'vitest'
import {
  sensaiTsToIso,
  parseAssistantContent,
  toChatMessage,
  blocksToText,
  parseScorecardCriteria,
  scoreBadgeClass,
} from '@/lib/sensaiChat'

// 2025-06-15T00:00:00Z as BigQuery mirrors it (epoch-seconds, sci-notation string).
const JUN_15_SECS = '1.749945600E9'
const JUN_15_ISO = '2025-06-15T00:00:00.000Z'
const JUN_15_MS = 1749945600000

describe('sensaiTsToIso', () => {
  test('epoch-seconds sci-notation string → ISO', () => {
    expect(sensaiTsToIso(JUN_15_SECS)).toBe(JUN_15_ISO)
  })
  test('epoch-seconds number → ISO', () => {
    expect(sensaiTsToIso(1749945600)).toBe(JUN_15_ISO)
  })
  test('epoch-millis number (>= 1e12) passes through without ×1000', () => {
    expect(sensaiTsToIso(JUN_15_MS)).toBe(JUN_15_ISO)
  })
  test('ISO string is parsed', () => {
    expect(sensaiTsToIso('2025-06-15T00:00:00Z')).toBe(JUN_15_ISO)
  })
  test('null / empty / garbage → null', () => {
    expect(sensaiTsToIso(null)).toBeNull()
    expect(sensaiTsToIso('')).toBeNull()
    expect(sensaiTsToIso('not-a-date')).toBeNull()
    expect(sensaiTsToIso(undefined)).toBeNull()
  })
})

describe('parseAssistantContent', () => {
  test('subjective scorecard: score below pass → not correct', () => {
    const raw = JSON.stringify({
      feedback: 'Nice try',
      scorecard: [{ score: 3, max_score: 4, pass_score: 4, feedback: { correct: 'ok bit', wrong: 'missing bit' } }],
    })
    expect(parseAssistantContent(raw)).toEqual({
      text: 'Nice try',
      score: '3/4',
      correct: false,
      feedback_correct: 'ok bit',
      feedback_wrong: 'missing bit',
    })
  })

  test('subjective scorecard: score >= pass → correct', () => {
    const raw = JSON.stringify({ feedback: 'Great', scorecard: [{ score: 4, max_score: 4, pass_score: 4 }] })
    const p = parseAssistantContent(raw)
    expect(p.score).toBe('4/4')
    expect(p.correct).toBe(true)
    expect(p.feedback_correct).toBeNull()
  })

  test('objective is_correct true', () => {
    const raw = JSON.stringify({ feedback: 'Correct pick', is_correct: true })
    expect(parseAssistantContent(raw)).toEqual({
      text: 'Correct pick',
      score: 'Correct',
      correct: true,
      feedback_correct: 'Correct pick',
      feedback_wrong: null,
    })
  })

  test('objective is_correct false routes feedback to wrong', () => {
    const raw = JSON.stringify({ feedback: 'Try again', is_correct: false })
    expect(parseAssistantContent(raw)).toEqual({
      text: 'Try again',
      score: 'Wrong',
      correct: false,
      feedback_correct: null,
      feedback_wrong: 'Try again',
    })
  })

  test('bare top-level score with max_score', () => {
    const raw = JSON.stringify({ feedback: 'x', score: 2, max_score: 5 })
    const p = parseAssistantContent(raw)
    expect(p.score).toBe('2/5')
    expect(p.correct).toBeNull()
  })

  test('invalid JSON falls back to raw text, no score', () => {
    expect(parseAssistantContent('plain text, not json')).toEqual({
      text: 'plain text, not json',
      score: null,
      correct: null,
      feedback_correct: null,
      feedback_wrong: null,
    })
  })
})

describe('toChatMessage', () => {
  test('user message keeps raw answer, no score, converts ts', () => {
    expect(toChatMessage('user', 'print("hi")', JUN_15_SECS)).toEqual({
      role: 'user',
      content: 'print("hi")',
      score: null,
      correct: null,
      feedback_correct: null,
      feedback_wrong: null,
      timestamp: JUN_15_ISO,
    })
  })

  test('assistant message is parsed and graded', () => {
    const raw = JSON.stringify({ feedback: 'Good', scorecard: [{ score: 4, max_score: 4, pass_score: 4 }] })
    const m = toChatMessage('assistant', raw, JUN_15_SECS)
    expect(m.role).toBe('assistant')
    expect(m.content).toBe('Good')
    expect(m.score).toBe('4/4')
    expect(m.correct).toBe(true)
    expect(m.timestamp).toBe(JUN_15_ISO)
  })

  test('null content / unparseable ts → empty string fields', () => {
    const m = toChatMessage('user', null, null)
    expect(m.content).toBe('')
    expect(m.timestamp).toBe('')
  })
})

describe('blocksToText', () => {
  test('flattens BlockNote content runs, one line per block', () => {
    const blocks = JSON.stringify([
      { content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] },
      { content: [{ type: 'text', text: 'Second line' }] },
    ])
    expect(blocksToText(blocks)).toBe('Hello world\nSecond line')
  })

  test('recurses into nested children', () => {
    const blocks = JSON.stringify([
      { content: [{ type: 'text', text: 'Parent' }], children: [{ content: [{ type: 'text', text: 'Child' }] }] },
    ])
    expect(blocksToText(blocks)).toBe('Parent\nChild')
  })

  test('skips empty blocks and trims', () => {
    const blocks = JSON.stringify([
      { content: [{ type: 'text', text: '   ' }] },
      { content: [{ type: 'text', text: 'Real' }] },
    ])
    expect(blocksToText(blocks)).toBe('Real')
  })

  test('null / invalid JSON / non-array → empty string', () => {
    expect(blocksToText(null)).toBe('')
    expect(blocksToText('not json')).toBe('')
    expect(blocksToText('{"not":"array"}')).toBe('')
  })
})

describe('parseScorecardCriteria', () => {
  test('parses categories with numeric bounds', () => {
    const raw = JSON.stringify([
      { name: 'Valid Options', description: 'pick one letter', min_score: 1, max_score: 4, pass_score: 4 },
    ])
    expect(parseScorecardCriteria(raw)).toEqual([
      { name: 'Valid Options', description: 'pick one letter', minScore: 1, maxScore: 4, passScore: 4 },
    ])
  })

  test('missing fields default to empty/null', () => {
    const raw = JSON.stringify([{ name: 'Score' }])
    expect(parseScorecardCriteria(raw)).toEqual([
      { name: 'Score', description: '', minScore: null, maxScore: null, passScore: null },
    ])
  })

  test('null / invalid JSON / non-array → empty array', () => {
    expect(parseScorecardCriteria(null)).toEqual([])
    expect(parseScorecardCriteria('not json')).toEqual([])
    expect(parseScorecardCriteria('{"a":1}')).toEqual([])
  })
})

describe('scoreBadgeClass', () => {
  test('x/y ratio buckets', () => {
    expect(scoreBadgeClass('4/4')).toContain('emerald') // 1.0
    expect(scoreBadgeClass('3/4')).toContain('amber') //   0.75
    expect(scoreBadgeClass('1/4')).toContain('red') //     0.25
  })
  test('objective labels', () => {
    expect(scoreBadgeClass('Correct')).toContain('emerald')
    expect(scoreBadgeClass('Wrong')).toContain('red')
  })
  test('null score → neutral', () => {
    expect(scoreBadgeClass(null)).toContain('zinc')
  })
})
