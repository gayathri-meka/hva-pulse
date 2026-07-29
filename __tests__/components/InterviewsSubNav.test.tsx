import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import InterviewsSubNav from '@/components/admissions/InterviewsSubNav'

let pathname = '/admissions/interviews'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

describe('InterviewsSubNav', () => {
  beforeEach(() => {
    pathname = '/admissions/interviews'
    sessionStorage.clear()
  })

  test('keeps the Review release-gate screen reachable', () => {
    render(<InterviewsSubNav />)

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Overview',
      'My calendar',
      'Interviews',
      'Notes',
      'Questions & rubrics',
      'Review',
    ])
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute(
      'href', '/admissions/interviews/review',
    )
  })

  test('remembers Review without replacing the Overview destination', async () => {
    pathname = '/admissions/interviews/review'
    const view = render(<InterviewsSubNav />)

    await waitFor(() => expect(screen.getByRole('link', { name: 'Review' }))
      .toHaveAttribute('href', '/admissions/interviews/review'))

    pathname = '/admissions/interviews/calendar'
    view.rerender(<InterviewsSubNav />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Overview' }))
        .toHaveAttribute('href', '/admissions/interviews')
      expect(screen.getByRole('link', { name: 'Review' }))
        .toHaveAttribute('href', '/admissions/interviews/review')
    })
  })
})
