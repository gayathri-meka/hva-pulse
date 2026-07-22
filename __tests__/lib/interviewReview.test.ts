import { describe, test, expect } from 'vitest'
import {
  computeInterviewReviewRow,
  roundState,
  stageLabel,
  type InterviewLite,
} from '@/lib/interviewReview'

const r1 = (status: InterviewLite['status'], recommendation?: InterviewLite['recommendation']): InterviewLite => ({ round: 1, status, recommendation })
const r2 = (status: InterviewLite['status'], recommendation?: InterviewLite['recommendation']): InterviewLite => ({ round: 2, status, recommendation })

describe('roundState', () => {
  test('missing interview → not_booked', () => {
    expect(roundState(undefined)).toEqual({ status: 'not_booked', recommendation: null })
  })
  test('booked/confirmed → scheduled', () => {
    expect(roundState(r1('booked')).status).toBe('scheduled')
    expect(roundState(r1('confirmed')).status).toBe('scheduled')
  })
  test('carries the recommendation', () => {
    expect(roundState(r1('completed', 'advance')).recommendation).toBe('advance')
  })
})

describe('computeInterviewReviewRow', () => {
  test('no interviews yet → stage round1, nothing releasable', () => {
    const row = computeInterviewReviewRow([], null)
    expect(row.stage).toBe('round1')
    expect(row.canReleaseStage1).toBe(false)
    expect(row.round1.status).toBe('not_booked')
  })

  test('R1 scheduled → still round1', () => {
    expect(computeInterviewReviewRow([r1('confirmed')], null).stage).toBe('round1')
  })

  test('R1 completed, no decision → awaiting_r1_review + can release stage 1', () => {
    const row = computeInterviewReviewRow([r1('completed', 'advance')], null)
    expect(row.stage).toBe('awaiting_r1_review')
    expect(row.canReleaseStage1).toBe(true)
    expect(row.canReleaseFinal).toBe(false)
  })

  test('R1 no_show also counts as done (team can decide)', () => {
    const row = computeInterviewReviewRow([r1('no_show')], null)
    expect(row.stage).toBe('awaiting_r1_review')
    expect(row.canReleaseStage1).toBe(true)
  })

  test('advance released, R2 not booked → round2_open', () => {
    const row = computeInterviewReviewRow([r1('completed', 'advance')], { stage1: 'advance', final: null })
    expect(row.stage).toBe('round2_open')
    expect(row.canReleaseStage1).toBe(false)
  })

  test('advance released, R2 scheduled → round2', () => {
    const row = computeInterviewReviewRow([r1('completed'), r2('confirmed')], { stage1: 'advance', final: null })
    expect(row.stage).toBe('round2')
    expect(row.canReleaseFinal).toBe(false)
  })

  test('advance released, R2 completed → awaiting_final + can release final', () => {
    const row = computeInterviewReviewRow([r1('completed'), r2('completed', 'advance')], { stage1: 'advance', final: null })
    expect(row.stage).toBe('awaiting_final')
    expect(row.canReleaseFinal).toBe(true)
  })

  test('rejected at stage 1 → rejected, no final release', () => {
    const row = computeInterviewReviewRow([r1('completed', 'no')], { stage1: 'rejected', final: null })
    expect(row.stage).toBe('rejected')
    expect(row.canReleaseFinal).toBe(false)
  })

  test('final selected → selected', () => {
    const row = computeInterviewReviewRow([r1('completed'), r2('completed')], { stage1: 'advance', final: 'selected' })
    expect(row.stage).toBe('selected')
    expect(row.canReleaseFinal).toBe(false)
  })

  test('final rejected → rejected', () => {
    const row = computeInterviewReviewRow([r1('completed'), r2('completed')], { stage1: 'advance', final: 'rejected' })
    expect(row.stage).toBe('rejected')
  })

  test('cancelled interviews are ignored', () => {
    const row = computeInterviewReviewRow([r1('cancelled'), r1('completed', 'advance')], null)
    expect(row.round1.status).toBe('completed')
    expect(row.canReleaseStage1).toBe(true)
  })

  test('stageLabel is human-readable', () => {
    expect(stageLabel('awaiting_final')).toBe('Awaiting final')
  })
})
