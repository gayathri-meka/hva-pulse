import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlacementSnapshot from '@/components/learner/PlacementSnapshot'

const baseProps = {
  total: 10,
  applied: 3,
  notInterested: 2,
  ignored: 5,
  shortlisted: 1,
  notShortlisted: 1,
  rejected: 0,
  hired: 0,
  pending: 1,
  applicationRate: 30,
  reasonCounts: {},
  ignoredOpenCount: 0,
  onViewIgnored: vi.fn(),
}

describe('PlacementSnapshot', () => {
  test('renders total, applied, not interested, and ignored counts', () => {
    render(<PlacementSnapshot {...baseProps} />)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  test('renders application rate line', () => {
    render(<PlacementSnapshot {...baseProps} />)
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  test('renders applications breakdown when applied > 0', () => {
    render(<PlacementSnapshot {...baseProps} />)
    expect(screen.getByText('Awaiting outcome')).toBeInTheDocument()
    expect(screen.getByText('In Process')).toBeInTheDocument()
    expect(screen.getByText('Not Shortlisted')).toBeInTheDocument()
  })

  test('hides applications breakdown when applied is 0', () => {
    render(<PlacementSnapshot {...baseProps} applied={0} pending={0} shortlisted={0} notShortlisted={0} />)
    expect(screen.queryByText('Awaiting outcome')).not.toBeInTheDocument()
  })

  test('does not show ignored open roles callout when ignoredOpenCount is 0', () => {
    render(<PlacementSnapshot {...baseProps} ignoredOpenCount={0} />)
    expect(screen.queryByText(/without a decision/)).not.toBeInTheDocument()
  })

  test('shows callout with correct count when ignoredOpenCount > 0', () => {
    render(<PlacementSnapshot {...baseProps} ignoredOpenCount={4} />)
    expect(screen.getByText(/4 open roles without a decision from you/)).toBeInTheDocument()
  })

  test('uses singular "role" when ignoredOpenCount is 1', () => {
    render(<PlacementSnapshot {...baseProps} ignoredOpenCount={1} />)
    expect(screen.getByText(/1 open role without a decision from you/)).toBeInTheDocument()
  })

  test('calls onViewIgnored when "View them" is clicked', () => {
    const onViewIgnored = vi.fn()
    render(<PlacementSnapshot {...baseProps} ignoredOpenCount={3} onViewIgnored={onViewIgnored} />)
    fireEvent.click(screen.getByRole('button', { name: /view them/i }))
    expect(onViewIgnored).toHaveBeenCalledOnce()
  })

  test('does not show expand chevron when there are no reasons', () => {
    render(<PlacementSnapshot {...baseProps} notInterested={2} reasonCounts={{}} />)
    expect(screen.queryByLabelText(/show reasons/i)).not.toBeInTheDocument()
  })

  test('shows expand chevron when reasons exist', () => {
    render(<PlacementSnapshot {...baseProps} notInterested={2} reasonCounts={{ 'Location Mismatch': 2 }} />)
    expect(screen.getByLabelText(/show reasons/i)).toBeInTheDocument()
  })

  test('toggles reasons breakdown when chevron is clicked', () => {
    render(<PlacementSnapshot {...baseProps} notInterested={2} reasonCounts={{ 'Location Mismatch': 2, 'Salary too low': 1 }} />)

    expect(screen.queryByText('Location Mismatch')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/show reasons/i))
    expect(screen.getByText('Location Mismatch')).toBeInTheDocument()
    expect(screen.getByText('Salary too low')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText(/hide reasons/i))
    expect(screen.queryByText('Location Mismatch')).not.toBeInTheDocument()
  })
})
