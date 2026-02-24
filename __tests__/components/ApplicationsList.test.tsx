import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('@/app/(protected)/placements/actions', () => ({
  updateApplicationStatus: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('./ExportButton', () => ({ default: () => null }))
vi.mock('@/components/placements/ExportButton', () => ({ default: () => null }))

import { updateApplicationStatus } from '@/app/(protected)/placements/actions'
import ApplicationsList from '@/components/placements/ApplicationsList'
import type { ApplicationWithLearner } from '@/types'

const makeApp = (overrides: Partial<ApplicationWithLearner> = {}): ApplicationWithLearner => ({
  id: 'app-1',
  role_id: 'role-1',
  learner_id: 'learner-1',
  user_id: 'user-1',
  status: 'applied',
  resume_url: null,
  created_at: '2024-01-15T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
  not_shortlisted_reason: null,
  rejection_feedback: null,
  learner_name: 'Priya Sharma',
  learner_email: 'priya@test.com',
  company_name: 'Acme Corp',
  role_title: 'Software Engineer',
  location: 'Mumbai',
  ...overrides,
})

describe('ApplicationsList', () => {
  beforeEach(() => { vi.clearAllMocks() })

  test('renders learner name and company', () => {
    render(<ApplicationsList applications={[makeApp()]} />)
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
  })

  test('shows empty state when no applications', () => {
    render(<ApplicationsList applications={[]} />)
    expect(screen.getByText('No applications found.')).toBeInTheDocument()
  })

  test('changing to a non-terminal status calls updateApplicationStatus directly', async () => {
    render(<ApplicationsList applications={[makeApp()]} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'shortlisted' } })
    await waitFor(() => {
      expect(updateApplicationStatus).toHaveBeenCalledWith('app-1', 'shortlisted')
    })
  })

  test('changing to not_shortlisted opens the reason modal', () => {
    render(<ApplicationsList applications={[makeApp()]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'not_shortlisted' } })
    expect(screen.getByText("Why wasn't this candidate shortlisted?")).toBeInTheDocument()
  })

  test('changing to rejected opens the feedback modal', () => {
    render(<ApplicationsList applications={[makeApp()]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'rejected' } })
    expect(screen.getByText('What feedback did the company provide?')).toBeInTheDocument()
  })

  test('modal cancel closes without updating status', async () => {
    render(<ApplicationsList applications={[makeApp()]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'not_shortlisted' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText("Why wasn't this candidate shortlisted?")).not.toBeInTheDocument()
    expect(updateApplicationStatus).not.toHaveBeenCalled()
  })

  test('modal confirm with empty note shows validation error', () => {
    render(<ApplicationsList applications={[makeApp()]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'not_shortlisted' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(screen.getByText('This field is required.')).toBeInTheDocument()
    expect(updateApplicationStatus).not.toHaveBeenCalled()
  })

  test('modal confirm with a note calls updateApplicationStatus and closes modal', async () => {
    render(<ApplicationsList applications={[makeApp()]} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'not_shortlisted' } })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Stronger candidates applied' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(updateApplicationStatus).toHaveBeenCalledWith(
        'app-1', 'not_shortlisted', 'Stronger candidates applied',
      )
    })
    expect(screen.queryByText("Why wasn't this candidate shortlisted?")).not.toBeInTheDocument()
  })

  test('existing not_shortlisted_reason is shown below status badge', () => {
    render(<ApplicationsList applications={[makeApp({ status: 'not_shortlisted', not_shortlisted_reason: 'Too competitive' })]} />)
    expect(screen.getByTitle('Too competitive')).toBeInTheDocument()
  })

  test('existing rejection_feedback is shown below status badge', () => {
    render(<ApplicationsList applications={[makeApp({ status: 'rejected', rejection_feedback: 'Needs more depth' })]} />)
    expect(screen.getByTitle('Needs more depth')).toBeInTheDocument()
  })
})
