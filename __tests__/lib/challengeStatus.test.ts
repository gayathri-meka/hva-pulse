import { describe, expect, test } from 'vitest'
import {
  challengeReviewConfigKey,
  challengeReviewInProgressByEmail,
} from '@/lib/challengeStatus'
import type { ChallengeRawRow } from '@/lib/challengeFunnel'

const NOW = Date.parse('2026-07-31T12:00:00Z')
const configKey = challengeReviewConfigKey('214', '587')

function row(email: string, taskId: string, attempted: number, lastActivity: string | null): ChallengeRawRow {
  return {
    learner_id: email,
    dimensions: {
      cohort_id: '214',
      course_id: '587',
      task_id: taskId,
      total_questions: '2',
      attempted_questions: String(attempted),
      last_activity_at: lastActivity,
    },
  }
}

describe('challenge Review system status', () => {
  test('normalises numeric configuration identifiers', () => {
    expect(challengeReviewConfigKey('0214', '587')).toBe(configKey)
    expect(challengeReviewConfigKey(null, undefined)).toBe('0|0')
  })

  test('matches the Review table in-progress completion and inactivity rules', () => {
    const rows = [
      row('joined@example.com', 'one', 0, null),
      row('active@example.com', 'one', 1, '2026-07-30T12:00:00Z'),
      row('complete@example.com', 'one', 2, '2026-07-30T12:00:00Z'),
      row('inactive@example.com', 'one', 1, '2026-07-20T12:00:00Z'),
    ]

    const status = challengeReviewInProgressByEmail(rows, new Map([[configKey, null]]), NOW)

    expect(status.get('joined@example.com')).toBe(true)
    expect(status.get('active@example.com')).toBe(true)
    expect(status.get('complete@example.com')).toBe(false)
    expect(status.get('inactive@example.com')).toBe(false)
  })

  test('uses the Review configuration challenge end date', () => {
    const status = challengeReviewInProgressByEmail(
      [row('ended@example.com', 'one', 0, null)],
      new Map([[configKey, '2026-07-30']]),
      NOW,
    )

    expect(status.get('ended@example.com')).toBe(false)
  })

  test('keeps the challenge in progress through the configured end date', () => {
    const status = challengeReviewInProgressByEmail(
      [row('ending@example.com', 'one', 0, null)],
      new Map([[configKey, '2026-07-31']]),
      Date.parse('2026-07-31T23:59:59Z'),
    )

    expect(status.get('ending@example.com')).toBe(true)
  })

  test('finishes at exactly seven days of inactivity but not one millisecond before', () => {
    const rows = [
      row('boundary@example.com', 'one', 1, '2026-07-24T12:00:00Z'),
      row('recent@example.com', 'one', 1, '2026-07-24T12:00:00.001Z'),
    ]

    const status = challengeReviewInProgressByEmail(rows, new Map([[configKey, null]]), NOW)

    expect(status.get('boundary@example.com')).toBe(false)
    expect(status.get('recent@example.com')).toBe(true)
  })

  test('adds question totals across tasks and ignores duplicate task rows', () => {
    const rows = [
      row('multi@example.com', 'one', 2, '2026-07-30T10:00:00Z'),
      row('multi@example.com', 'two', 1, '2026-07-30T11:00:00Z'),
      row('multi@example.com', 'two', 1, '2026-07-20T11:00:00Z'),
    ]

    const status = challengeReviewInProgressByEmail(rows, new Map([[configKey, null]]), NOW)

    // Three of four questions are attempted. Counting the duplicate would incorrectly
    // make the candidate look complete.
    expect(status.get('multi@example.com')).toBe(true)
  })

  test('normalises emails and accepts epoch-second activity timestamps', () => {
    const epochSeconds = String(Date.parse('2026-07-30T12:00:00Z') / 1000)
    const status = challengeReviewInProgressByEmail(
      [row('  PERSON@Example.COM ', 'one', 1, epochSeconds)],
      new Map([[configKey, null]]),
      NOW,
    )

    expect(status.get('person@example.com')).toBe(true)
    expect(status.size).toBe(1)
  })

  test('ignores rows without an email address', () => {
    const status = challengeReviewInProgressByEmail(
      [row('', 'one', 1, '2026-07-30T12:00:00Z')],
      new Map([[configKey, null]]),
      NOW,
    )

    expect(status.size).toBe(0)
  })
})
