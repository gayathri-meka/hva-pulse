import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ChallengeReviewDrawer from '@/components/admissions/ChallengeReviewDrawer'
import type { ChallengeReviewRow } from '@/components/admissions/ChallengeReviewTable'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/(protected)/admissions/challenge/actions', () => ({
  setChallengeDecision: vi.fn(),
  releaseChallengeDecisions: vi.fn(),
  clearChallengeDecisions: vi.fn(),
  getLearnerTaskDetail: vi.fn(),
}))

const row: ChallengeReviewRow = {
  email: 'learner@example.com',
  name: 'Test Learner',
  phone: null,
  source: 'pulse',
  signals: {
    attemptedQuestions: 10,
    totalQuestions: 10,
    attemptedItems: 10,
    totalItems: 10,
    activeDays: 5,
    spanDays: 7,
    crammingPct: 20,
  },
  criteria: [
    {
      key: 'ses', label: 'SES need score', group: 'need', status: 'pass',
      value: '50', threshold: 'At least 40', placeholder: false,
    },
    {
      key: 'per_capita_income', label: 'Per-capita income', group: 'need', status: 'pass',
      value: '₹50,000', threshold: 'Under ₹100,000', placeholder: false,
    },
    {
      key: 'active_days', label: 'Active days', group: 'engagement', status: 'pass',
      value: '5 days', threshold: 'More than 4 days', placeholder: false,
    },
  ],
  systemDecision: 'selected',
  failReasons: [],
  finalDecision: null,
  reason: null,
  rejectionReasonType: null,
  rejectionMessage: null,
  overrodeSystem: false,
  decidedByName: null,
  decidedAt: null,
  systemChanged: false,
  published: false,
  completedItems: 10,
  totalItems: 10,
  activityByDate: {},
  questionsByDate: {},
}

describe('ChallengeReviewDrawer', () => {
  it('omits per-capita income while retaining the other review criteria', () => {
    render(
      <ChallengeReviewDrawer
        row={row}
        cohortId={1}
        courseId={587}
        canReview={false}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText('Per-capita income')).not.toBeInTheDocument()
    expect(screen.getByText('SES need score')).toBeInTheDocument()
    expect(screen.getByText('Active days')).toBeInTheDocument()
  })
})
