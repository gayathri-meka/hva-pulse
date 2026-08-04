import { describe, expect, test } from 'vitest'
import {
  challengeDecisionKey,
  codingInterviewStatus,
  finalVerdictStatus,
  motivationInterviewStatus,
  personalInterviewDecision,
  prospectChallengeStatus,
  type CodingInterviewStatus,
  type FinalVerdictStatus,
  type MotivationInterviewStatus,
  type ProspectChallengeStatus,
} from '@/lib/prospectPipeline'

describe('prospect pipeline joins', () => {
  test('normalises email and keeps challenge cohorts/courses isolated', () => {
    expect(challengeDecisionKey(' Learner@Example.COM ', 214, 587)).toBe('learner@example.com|214|587')
    expect(challengeDecisionKey('learner@example.com', 215, 587)).not.toBe(
      challengeDecisionKey('learner@example.com', 214, 587),
    )
    expect(challengeDecisionKey('learner@example.com', 214, 588)).not.toBe(
      challengeDecisionKey('learner@example.com', 214, 587),
    )
  })

  test.each([
    [null, 'advance', 'advance'],
    [null, 'no', 'rejected'],
    [null, 'borderline', null],
    [null, null, null],
    ['rejected', 'advance', 'rejected'],
    ['advance', 'no', 'advance'],
  ] as const)('resolves released decision=%s and recommendation=%s to %s', (released, recommendation, expected) => {
    expect(personalInterviewDecision(released, recommendation)).toBe(expected)
  })
})

describe('14-day challenge pipeline status', () => {
  test.each<[
    Parameters<typeof prospectChallengeStatus>[0],
    Parameters<typeof prospectChallengeStatus>[1],
    boolean | undefined,
    ProspectChallengeStatus,
  ]>([
    ['Not joined', null, undefined, 'Not Joined'],
    ['Joined', null, false, 'Joined'],
    ['Joined', null, true, 'In Progress'],
    ['Started', null, true, 'In Progress'],
    ['Completed', null, false, 'Decision Pending'],
    ['Started', { finalDecision: 'selected', released: false }, true, 'In Progress'],
    ['Completed', { finalDecision: 'rejected', released: false }, false, 'Decision Pending'],
    ['Completed', { finalDecision: 'selected', released: true }, false, 'Selected'],
    ['Completed', { finalDecision: 'rejected', released: true }, false, 'Rejected'],
  ])('maps system=%s, decision=%o, inProgress=%s to %s', (system, decision, inProgress, expected) => {
    expect(prospectChallengeStatus(system, decision, inProgress)).toBe(expected)
  })

  test('a released decision takes precedence over current challenge activity', () => {
    expect(prospectChallengeStatus('Started', { finalDecision: 'selected', released: true }, true)).toBe('Selected')
    expect(prospectChallengeStatus('Started', { finalDecision: 'rejected', released: true }, true)).toBe('Rejected')
  })
})

describe('personal interview pipeline status', () => {
  test.each<[
    ProspectChallengeStatus,
    string | null,
    Parameters<typeof motivationInterviewStatus>[2],
    MotivationInterviewStatus,
  ]>([
    ['In Progress', 'completed', 'advance', 'Not Done'],
    ['Rejected', 'completed', 'advance', null],
    ['Selected', null, null, 'Not Done'],
    ['Selected', 'booked', null, 'Not Done'],
    ['Selected', 'completed', null, 'Decision Pending'],
    ['Selected', 'completed', 'advance', 'Selected'],
    ['Selected', 'completed', 'rejected', 'Rejected'],
  ])('maps challenge=%s, interview=%s, recommendation=%s to %s', (challenge, interview, recommendation, expected) => {
    expect(motivationInterviewStatus(challenge, interview, recommendation)).toBe(expected)
  })

  test('a final recommendation takes precedence over an incomplete interview row', () => {
    expect(motivationInterviewStatus('Selected', 'booked', 'advance')).toBe('Selected')
    expect(motivationInterviewStatus('Selected', 'booked', 'rejected')).toBe('Rejected')
  })
})

describe('coding interview and final verdict status', () => {
  test.each<[
    string | null,
    Parameters<typeof codingInterviewStatus>[1],
    MotivationInterviewStatus,
    ProspectChallengeStatus,
    CodingInterviewStatus,
  ]>([
    ['not_started', null, 'Selected', 'Selected', 'Not Done'],
    ['booked', null, 'Selected', 'Selected', 'Not Done'],
    ['completed', null, 'Selected', 'Selected', 'Decision Pending'],
    ['completed', 'selected', 'Selected', 'Selected', 'Selected'],
    ['completed', 'rejected', 'Selected', 'Selected', 'Rejected'],
    ['not_started', null, 'Rejected', 'Selected', null],
    ['completed', 'selected', null, 'Rejected', null],
  ])('maps interview=%s, verdict=%s, personal=%s, challenge=%s to %s', (interview, verdict, personal, challenge, expected) => {
    expect(codingInterviewStatus(interview, verdict, personal, challenge)).toBe(expected)
  })

  test('a coding verdict takes precedence over the interview completion state', () => {
    expect(codingInterviewStatus('not_started', 'selected', 'Selected', 'Selected')).toBe('Selected')
    expect(codingInterviewStatus('booked', 'rejected', 'Selected', 'Selected')).toBe('Rejected')
  })

  test.each<[
    ProspectChallengeStatus,
    MotivationInterviewStatus,
    CodingInterviewStatus,
    FinalVerdictStatus,
  ]>([
    ['Joined', null, 'Not Done', 'Decision Pending'],
    ['Rejected', null, null, 'Rejected'],
    ['Selected', 'Rejected', null, 'Rejected'],
    ['Selected', 'Selected', 'Selected', 'Selected'],
    ['Selected', 'Selected', 'Rejected', 'Rejected'],
    ['Rejected', 'Selected', 'Selected', 'Rejected'],
  ])('maps challenge=%s, personal=%s, coding=%s to final=%s', (challenge, personal, coding, expected) => {
    expect(finalVerdictStatus(challenge, personal, coding)).toBe(expected)
  })
})
