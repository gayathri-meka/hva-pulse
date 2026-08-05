import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import InterviewsListTable from '@/app/(protected)/admissions/interviews/list/InterviewsListTable'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

vi.mock('@/app/(protected)/admissions/interviews/actions', () => ({
  setInterviewOutcome: vi.fn(),
  cancelInterview: vi.fn(),
}))

vi.mock('@/components/interviews/NotesReviewButton', () => ({ default: () => null }))

vi.mock('@/components/ui/DataTable', () => ({
  default: ({ toolbarLeft, data }: { toolbarLeft: React.ReactNode; data: { candidateEmail: string }[] }) => (
    <div>{toolbarLeft}<div data-testid="rows">{data.map((row) => row.candidateEmail).join(',')}</div></div>
  ),
}))

describe('InterviewsListTable view persistence', () => {
  beforeEach(() => sessionStorage.clear())

  test('restores the Completed view after remounting', async () => {
    const first = render(<InterviewsListTable interviews={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }))
    await waitFor(() => expect(sessionStorage.getItem('hva-pulse:state:admissions-interviews-list:view'))
      .toBe('"completed"'))
    first.unmount()

    render(<InterviewsListTable interviews={[]} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Completed' }))
      .toHaveClass('bg-zinc-900'))
  })

  test('shows a cancelled-only candidate under Not Scheduled without duplicating them', () => {
    render(<InterviewsListTable interviews={[{
      id: 'iv-1', candidateEmail: 'cancelled@example.com', candidateName: 'Cancelled Candidate',
      round: 1, slotId: 'slot-1', interviewerEmail: 'staff@example.com', interviewerName: 'Staff',
      scheduledAt: '2026-08-01T10:00:00.000Z', status: 'cancelled', meetLink: null,
      recommendation: null, hasNotes: false,
    }]} candidates={[{
      email: 'cancelled@example.com', name: 'Cancelled Candidate',
      round1: { status: 'not_booked', recommendation: null, interviewId: null, interviewerName: null },
      round2: { status: 'not_booked', recommendation: null, interviewId: null, interviewerName: null },
      stage: 'round1', stage1: null, final: null,
      canReleaseStage1: false, canReleaseFinal: false,
    }]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Not Scheduled' }))
    expect(screen.getByTestId('rows')).toHaveTextContent('cancelled@example.com')
    expect(screen.getByTestId('rows').textContent?.match(/cancelled@example.com/g)).toHaveLength(1)
  })
})
