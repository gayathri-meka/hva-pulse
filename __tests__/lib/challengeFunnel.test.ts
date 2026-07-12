import { describe, test, expect } from 'vitest'
import {
  challengeFunnel,
  challengeEventDates,
  challengeStatusByEmail,
  type ChallengeRawRow,
} from '@/lib/challengeFunnel'

// epoch-seconds (sci-notation, as mirrored from BigQuery TIMESTAMP) for known dates
const JUN_15 = '1.749945600E9' // 2025-06-15T00:00:00Z
const JUN_18 = '1.750204800E9' // 2025-06-18T00:00:00Z

function row(
  email: string | null,
  state: string,
  taskId: string,
  extra: Record<string, string> = {},
): ChallengeRawRow {
  return { learner_id: email, dimensions: { state, task_id: taskId, ...extra } }
}

describe('challengeFunnel', () => {
  test('counts unique emails as joined, any activity as started, all-passed as completed', () => {
    const rows: ChallengeRawRow[] = [
      // a: joined only (both tasks untouched)
      row('a@x.com', 'not_started', 't1'),
      row('a@x.com', 'not_started', 't2'),
      // b: started (one task attempted)
      row('b@x.com', 'attempted', 't1'),
      row('b@x.com', 'not_started', 't2'),
      // c: completed (every task completed)
      row('c@x.com', 'completed', 't1'),
      row('c@x.com', 'completed', 't2'),
    ]
    // c attempted all their items (both tasks touched) → attemptedAllItems 1.
    expect(challengeFunnel(rows)).toEqual({ joined: 3, started: 2, completed: 1, attemptedAllItems: 1 })
  })

  test('uniform duplicate rows do not break the completed === total check', () => {
    // syncDataSource can leave duplicate (member, task) rows; completed===total
    // is preserved because duplication is uniform across a learner's tasks.
    const rows: ChallengeRawRow[] = [
      row('c@x.com', 'completed', 't1'),
      row('c@x.com', 'completed', 't1'), // dup
      row('c@x.com', 'completed', 't2'),
      row('c@x.com', 'completed', 't2'), // dup
    ]
    expect(challengeFunnel(rows)).toEqual({ joined: 1, started: 1, completed: 1, attemptedAllItems: 1 })
  })

  test('ignores blank emails', () => {
    const rows: ChallengeRawRow[] = [row('', 'completed', 't1'), row(null, 'completed', 't1')]
    expect(challengeFunnel(rows)).toEqual({ joined: 0, started: 0, completed: 0, attemptedAllItems: 0 })
  })

  test('attemptedAllItems counts items (quiz questions + reading), not tasks', () => {
    const rows: ChallengeRawRow[] = [
      // p: attempted all items — reading done + all 10 quiz questions attempted (but not passed → not "completed")
      row('p@x.com', 'completed', 'read', { task_type: 'learning_material' }),
      row('p@x.com', 'attempted', 'quiz', { task_type: 'quiz', total_questions: '10', attempted_questions: '10' }),
      // q: only 5 of 10 questions attempted → not all items
      row('q@x.com', 'completed', 'read', { task_type: 'learning_material' }),
      row('q@x.com', 'attempted', 'quiz', { task_type: 'quiz', total_questions: '10', attempted_questions: '5' }),
    ]
    const f = challengeFunnel(rows)
    expect(f.attemptedAllItems).toBe(1) // only p
    expect(f.completed).toBe(0) // neither completed every task
  })
})

describe('challengeEventDates', () => {
  test('joined uses joined_at; started uses earliest activity; completed uses latest', () => {
    const rows: ChallengeRawRow[] = [
      // started learner: first activity Jun 15, later activity Jun 18
      row('b@x.com', 'attempted', 't1', { joined_at: JUN_15, last_activity_at: JUN_18 }),
      row('b@x.com', 'attempted', 't2', { joined_at: JUN_15, last_activity_at: JUN_15 }),
      // completed learner: all tasks completed, last activity Jun 18
      row('c@x.com', 'completed', 't1', { joined_at: JUN_15, last_activity_at: JUN_15 }),
      row('c@x.com', 'completed', 't2', { joined_at: JUN_15, last_activity_at: JUN_18 }),
    ]
    const d = challengeEventDates(rows)
    expect(d.joined.sort()).toEqual([
      '2025-06-15T00:00:00.000Z',
      '2025-06-15T00:00:00.000Z',
    ])
    // earliest activity per started learner
    expect(d.started).toEqual([
      '2025-06-15T00:00:00.000Z', // b: min(Jun18, Jun15)
      '2025-06-15T00:00:00.000Z', // c: min(Jun15, Jun18)
    ])
    // latest activity for the completed learner
    expect(d.completed).toEqual(['2025-06-18T00:00:00.000Z'])
  })

  test('joined is empty when joined_at is absent (pre-resync), counts still work', () => {
    const rows: ChallengeRawRow[] = [
      row('a@x.com', 'not_started', 't1'),
      row('b@x.com', 'attempted', 't1', { last_activity_at: JUN_15 }),
    ]
    const d = challengeEventDates(rows)
    expect(d.joined).toEqual([])
    expect(d.started).toEqual(['2025-06-15T00:00:00.000Z'])
    expect(d.completed).toEqual([])
  })

  test('not_started learners contribute no started/completed date', () => {
    const rows: ChallengeRawRow[] = [row('a@x.com', 'not_started', 't1', { joined_at: JUN_15 })]
    const d = challengeEventDates(rows)
    expect(d.joined).toEqual(['2025-06-15T00:00:00.000Z'])
    expect(d.started).toEqual([])
  })
})

describe('challengeStatusByEmail', () => {
  test('maps each email to its furthest stage', () => {
    const rows: ChallengeRawRow[] = [
      row('a@x.com', 'not_started', 't1'),
      row('b@x.com', 'attempted', 't1'),
      row('c@x.com', 'completed', 't1'),
    ]
    const m = challengeStatusByEmail(rows)
    expect(m.get('a@x.com')).toBe('Joined')
    expect(m.get('b@x.com')).toBe('Started')
    expect(m.get('c@x.com')).toBe('Completed')
  })
})
