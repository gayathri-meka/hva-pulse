import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import NavLinks from '@/components/NavLinks'

let pathname = '/dashboard'
let query = ''

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(query),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('NavLinks route restoration', () => {
  beforeEach(() => {
    pathname = '/dashboard'
    query = ''
    sessionStorage.clear()
  })

  test('uses existing default destinations when no route has been remembered', () => {
    render(<NavLinks role="staff" />)
    expect(screen.getByRole('link', { name: 'Placements' })).toHaveAttribute('href', '/placements')
    expect(screen.getByRole('link', { name: 'Learning' })).toHaveAttribute('href', '/learning')
  })

  test('restores the last pathname and query for each module', async () => {
    pathname = '/placements/companies'
    query = 'view=table'
    const view = render(<NavLinks role="staff" />)

    await act(async () => {})
    expect(screen.getByRole('link', { name: 'Placements' }))
      .toHaveAttribute('href', '/placements/companies?view=table')

    pathname = '/learning/deep-dive'
    query = 'cohort=FY26'
    view.rerender(<NavLinks role="staff" />)

    await act(async () => {})
    expect(screen.getByRole('link', { name: 'Learning' }))
      .toHaveAttribute('href', '/learning/deep-dive?cohort=FY26')
    expect(screen.getByRole('link', { name: 'Placements' }))
      .toHaveAttribute('href', '/placements/companies?view=table')
  })

  test('updates a remembered route when only URL state changes', async () => {
    pathname = '/placements/companies'
    query = 'view=cards'
    const view = render(<NavLinks role="staff" />)

    await act(async () => {})
    query = 'view=table'
    view.rerender(<NavLinks role="staff" />)

    await act(async () => {})
    expect(screen.getByRole('link', { name: 'Placements' }))
      .toHaveAttribute('href', '/placements/companies?view=table')
  })

  test('restores Settings alias routes for an admin', async () => {
    pathname = '/users'
    render(<NavLinks role="admin" />)

    await act(async () => {})
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/users')
  })

  test.each(['admin', 'staff', 'guest'] as const)('restores routes for the %s navigation', async (role) => {
    pathname = '/placements/applications'
    query = 'status=hired'
    render(<NavLinks role={role} />)

    await act(async () => {})
    expect(screen.getByRole('link', { name: 'Placements' }))
      .toHaveAttribute('href', '/placements/applications?status=hired')
  })
})
