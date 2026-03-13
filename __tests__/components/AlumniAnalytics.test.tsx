import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import AlumniAnalytics from '@/components/alumni/AlumniAnalytics'

describe('AlumniAnalytics', () => {
  test('renders FY rows with counts', () => {
    render(<AlumniAnalytics fyRows={[
      { placed_fy: '2023-24', count: 12 },
      { placed_fy: '2024-25', count: 20 },
    ]} />)
    expect(screen.getByText('2023-24')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('2024-25')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  test('shows total row summing all counts', () => {
    render(<AlumniAnalytics fyRows={[
      { placed_fy: '2023-24', count: 12 },
      { placed_fy: '2024-25', count: 20 },
    ]} />)
    expect(screen.getByText('32')).toBeInTheDocument()
  })

  test('shows empty state when no rows', () => {
    render(<AlumniAnalytics fyRows={[]} />)
    expect(screen.getByText('No placement data yet')).toBeInTheDocument()
  })

  test('does not render total row when empty', () => {
    render(<AlumniAnalytics fyRows={[]} />)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  test('renders a single row correctly', () => {
    render(<AlumniAnalytics fyRows={[{ placed_fy: '2025-26', count: 5 }]} />)
    expect(screen.getByText('2025-26')).toBeInTheDocument()
    expect(screen.getAllByText('5')).toHaveLength(2) // count cell + total cell
  })
})
