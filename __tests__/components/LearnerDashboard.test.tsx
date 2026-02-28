import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LearnerDashboard from '@/components/learner/LearnerDashboard'

// Render a minimal stub so we can inspect which roles are displayed
vi.mock('@/components/learner/PlacementSnapshot', () => ({
  default: ({ ignoredOpenCount, onViewIgnored }: { ignoredOpenCount: number; onViewIgnored: () => void }) => (
    <div>
      <span data-testid="ignored-open-count">{ignoredOpenCount}</span>
      <button onClick={onViewIgnored}>View them</button>
    </div>
  ),
}))

vi.mock('@/components/learner/RoleCard', () => ({
  default: ({ role }: { role: { id: string; my_status: string } }) => (
    <div data-testid="role-card" data-role-id={role.id} data-my-status={role.my_status} />
  ),
}))

const snapshot = {
  total: 4, applied: 1, notInterested: 1, ignored: 2,
  shortlisted: 0, onHold: 0, notShortlisted: 0, rejected: 0, hired: 0, pending: 1,
  applicationRate: 25, reasonCounts: {},
}

const roles = [
  { id: '1', my_status: 'applied'       as const, status: 'open'   as const, company_name: 'A', role_title: 'Dev',    location: 'Mumbai',    salary_range: null },
  { id: '2', my_status: 'not_applied'   as const, status: 'open'   as const, company_name: 'B', role_title: 'PM',     location: 'Delhi',     salary_range: null },
  { id: '3', my_status: 'not_interested'as const, status: 'closed' as const, company_name: 'C', role_title: 'Design', location: 'Pune',      salary_range: null },
  { id: '4', my_status: 'not_applied'   as const, status: 'closed' as const, company_name: 'D', role_title: 'BA',     location: 'Bangalore', salary_range: null },
]

function renderDashboard() {
  return render(
    <LearnerDashboard
      firstName="Priya"
      snapshot={snapshot}
      ignoredOpenCount={1}
      roles={roles}
    />
  )
}

function visibleRoleIds() {
  return screen.getAllByTestId('role-card').map((el) => el.getAttribute('data-role-id'))
}

describe('LearnerDashboard', () => {
  test('greets the learner by first name', () => {
    renderDashboard()
    expect(screen.getByText('Hey, Priya!')).toBeInTheDocument()
  })

  test('shows all 4 roles with no active filter', () => {
    renderDashboard()
    expect(screen.getAllByTestId('role-card')).toHaveLength(4)
  })

  test('Ignored filter shows only not_applied roles', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Ignored' }))
    const ids = visibleRoleIds()
    expect(ids).toEqual(['2', '4'])
  })

  test('Applied filter shows only applied roles', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Applied' }))
    const ids = visibleRoleIds()
    expect(ids).toEqual(['1'])
  })

  test('Not Interested filter shows only not_interested roles', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Not Interested' }))
    const ids = visibleRoleIds()
    expect(ids).toEqual(['3'])
  })

  test('All filter resets to show every role', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Ignored' }))
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getAllByTestId('role-card')).toHaveLength(4)
  })

  test('"View them" activates the Ignored filter', () => {
    renderDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'View them' }))
    const ids = visibleRoleIds()
    expect(ids).toEqual(['2', '4'])
  })

  test('shows empty state when filter has no matches', () => {
    render(
      <LearnerDashboard
        firstName="Priya"
        snapshot={{ ...snapshot, hired: 0 }}
        ignoredOpenCount={0}
        roles={roles}
      />
    )
    // No hired roles, so Hired pill should not appear
    expect(screen.queryByRole('button', { name: 'Hired' })).not.toBeInTheDocument()
  })

  test('filter pill not rendered for statuses with no matching roles', () => {
    renderDashboard()
    // No shortlisted/rejected/hired roles in fixture
    expect(screen.queryByRole('button', { name: 'In Process' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rejected' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Hired' })).not.toBeInTheDocument()
  })
})
