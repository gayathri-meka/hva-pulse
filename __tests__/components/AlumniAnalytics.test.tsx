import { describe, test, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/app/(protected)/alumni/actions', () => ({
  updateAlumniRow:  vi.fn().mockResolvedValue(undefined),
  upsertCohortStat: vi.fn().mockResolvedValue(undefined),
}))

import AlumniAnalytics from '@/components/alumni/AlumniAnalytics'

const noCohorts: never[] = []

describe('AlumniAnalytics — FY tab (default)', () => {
  test('renders FY rows with counts', () => {
    render(<AlumniAnalytics fyRows={[
      { placed_fy: '2023-24', count: 12 },
      { placed_fy: '2024-25', count: 20 },
    ]} cohortRows={noCohorts} />)
    expect(screen.getByText('2023-24')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('2024-25')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
  })

  test('shows total row summing all counts', () => {
    render(<AlumniAnalytics fyRows={[
      { placed_fy: '2023-24', count: 12 },
      { placed_fy: '2024-25', count: 20 },
    ]} cohortRows={noCohorts} />)
    expect(screen.getByText('32')).toBeInTheDocument()
  })

  test('shows empty state when no FY rows', () => {
    render(<AlumniAnalytics fyRows={[]} cohortRows={noCohorts} />)
    expect(screen.getByText('No placement data yet')).toBeInTheDocument()
  })

  test('does not render total row when empty', () => {
    render(<AlumniAnalytics fyRows={[]} cohortRows={noCohorts} />)
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
  })

  test('renders a single FY row and shows same value in total', () => {
    render(<AlumniAnalytics fyRows={[{ placed_fy: '2025-26', count: 5 }]} cohortRows={noCohorts} />)
    expect(screen.getByText('2025-26')).toBeInTheDocument()
    // count cell + total footer both show "5"
    expect(screen.getAllByText('5')).toHaveLength(2)
  })
})
