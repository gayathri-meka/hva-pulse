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

vi.mock('@/components/ui/DataTable', () => ({
  default: ({ toolbarLeft }: { toolbarLeft: React.ReactNode }) => <div>{toolbarLeft}</div>,
}))

describe('InterviewsListTable view persistence', () => {
  beforeEach(() => sessionStorage.clear())

  test('restores the Completed view after remounting', async () => {
    const first = render(<InterviewsListTable interviews={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'completed' }))
    await waitFor(() => expect(sessionStorage.getItem('hva-pulse:state:admissions-interviews-list:view'))
      .toBe('"completed"'))
    first.unmount()

    render(<InterviewsListTable interviews={[]} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'completed' }))
      .toHaveClass('bg-zinc-900'))
  })
})
