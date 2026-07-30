import { describe, expect, test } from 'vitest'
import { codingInterviewStatus, finalVerdictStatus, motivationInterviewStatus, prospectChallengeStatus } from '@/lib/prospectPipeline'

describe('prospect pipeline statuses', () => {
  test('maps challenge activity before and after release', () => {
    expect(prospectChallengeStatus('Not joined', null)).toBe('Not Joined')
    expect(prospectChallengeStatus('Joined', null)).toBe('Joined')
    expect(prospectChallengeStatus('Started', null)).toBe('In Progress')
    expect(prospectChallengeStatus('Completed', null)).toBe('Decision Pending')
    expect(prospectChallengeStatus('Started', { finalDecision: 'selected', released: false })).toBe('In Progress')
    expect(prospectChallengeStatus('Completed', { finalDecision: 'rejected', released: false })).toBe('Decision Pending')
    expect(prospectChallengeStatus('Completed', { finalDecision: 'selected', released: true })).toBe('Selected')
    expect(prospectChallengeStatus('Completed', { finalDecision: 'rejected', released: true })).toBe('Rejected')
  })

  test('maps motivation status from completion and the first decision gate', () => {
    expect(motivationInterviewStatus(false, null)).toBe('Not Done')
    expect(motivationInterviewStatus(true, null)).toBe('Decision Pending')
    expect(motivationInterviewStatus(true, { stage1: 'advance', final: null })).toBe('Selected')
    expect(motivationInterviewStatus(true, { stage1: 'rejected', final: null })).toBe('Rejected')
  })

  test('maps coding and final statuses from both decision gates', () => {
    expect(codingInterviewStatus(false, { stage1: 'advance', final: null })).toBe('Not Done')
    expect(codingInterviewStatus(true, { stage1: 'advance', final: null })).toBe('Decision Pending')
    expect(codingInterviewStatus(true, { stage1: 'advance', final: 'selected' })).toBe('Selected')
    expect(codingInterviewStatus(true, { stage1: 'advance', final: 'rejected' })).toBe('Rejected')
    expect(finalVerdictStatus(null)).toBe('Decision Pending')
    expect(finalVerdictStatus({ stage1: 'rejected', final: null })).toBe('Rejected')
    expect(finalVerdictStatus({ stage1: 'advance', final: 'selected' })).toBe('Selected')
    expect(finalVerdictStatus({ stage1: 'advance', final: 'rejected' })).toBe('Rejected')
  })
})
