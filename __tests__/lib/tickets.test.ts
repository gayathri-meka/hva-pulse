import { describe, test, expect } from 'vitest'
import { canActOnTicket, spocName, priorityStyle, STATUS_LABEL, STATUS_STYLE } from '@/lib/tickets'

describe('canActOnTicket', () => {
  const spocTicket = { spoc_emails: ['hrishi@hyperverge.co', 'veema@hyperverge.co'] }

  test('admin can always act, even when not a SPOC', () => {
    expect(canActOnTicket({ email: 'boss@hyperverge.co', role: 'admin' }, spocTicket)).toBe(true)
  })

  test('assigned SPOC can act', () => {
    expect(canActOnTicket({ email: 'hrishi@hyperverge.co', role: 'staff' }, spocTicket)).toBe(true)
  })

  test('SPOC match is case-insensitive and trimmed', () => {
    expect(canActOnTicket({ email: '  HRISHI@hyperverge.co ', role: 'staff' }, spocTicket)).toBe(true)
  })

  test('non-SPOC staff cannot act (view-only)', () => {
    expect(canActOnTicket({ email: 'someone@hyperverge.co', role: 'staff' }, spocTicket)).toBe(false)
  })

  test('guest / learner cannot act', () => {
    expect(canActOnTicket({ email: 'hrishi@hyperverge.co', role: 'guest' }, spocTicket)).toBe(true) // still a SPOC by email
    expect(canActOnTicket({ email: 'guest@hyperverge.co', role: 'guest' }, spocTicket)).toBe(false)
  })

  test('empty email is rejected for non-admins', () => {
    expect(canActOnTicket({ email: '', role: 'staff' }, spocTicket)).toBe(false)
  })

  test('ticket with no SPOC emails is view-only for non-admins', () => {
    expect(canActOnTicket({ email: 'hrishi@hyperverge.co', role: 'staff' }, { spoc_emails: [] })).toBe(false)
  })
})

describe('spocName', () => {
  const users = [{ email: 'hrishi@hyperverge.co', name: 'Hrishi' }, { email: 'veema@hyperverge.co', name: 'Veema' }]

  test('resolves a known email to its user name (case-insensitive)', () => {
    expect(spocName('hrishi@hyperverge.co', users)).toBe('Hrishi')
    expect(spocName('HRISHI@hyperverge.co', users)).toBe('Hrishi')
  })

  test('falls back to the email when unknown or roster empty', () => {
    expect(spocName('nobody@hyperverge.co', users)).toBe('nobody@hyperverge.co')
    expect(spocName('hrishi@hyperverge.co')).toBe('hrishi@hyperverge.co')
  })
})

describe('priorityStyle', () => {
  test('distinct styling per priority, Low as the default', () => {
    expect(priorityStyle('High')).toContain('red')
    expect(priorityStyle('Medium')).toContain('amber')
    expect(priorityStyle('Low')).toContain('emerald')
    expect(priorityStyle('anything else')).toContain('emerald')
  })
})

describe('status maps', () => {
  test('label + style cover all three states', () => {
    expect(STATUS_LABEL.open).toBe('Open')
    expect(STATUS_LABEL.escalated).toBe('Escalated')
    expect(STATUS_LABEL.closed).toBe('Closed')
    expect(STATUS_STYLE.open).toBeTruthy()
    expect(STATUS_STYLE.escalated).toContain('red')
    expect(STATUS_STYLE.closed).toBeTruthy()
  })
})
