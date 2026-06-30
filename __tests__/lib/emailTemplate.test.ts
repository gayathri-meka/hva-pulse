import { describe, test, expect } from 'vitest'
import {
  extractPlaceholders,
  renderTemplate,
  missingPlaceholders,
  isEmail,
  resolveRecipients,
} from '@/lib/emailTemplate'

describe('extractPlaceholders', () => {
  test('finds distinct fields, tolerates inner whitespace', () => {
    expect(extractPlaceholders('Hi <<name>>, your <<plan>> — <<name>>').sort()).toEqual(['name', 'plan'])
    expect(extractPlaceholders('a << spaced >> b')).toEqual(['spaced'])
  })
  test('none → empty', () => {
    expect(extractPlaceholders('plain text')).toEqual([])
  })
})

describe('renderTemplate', () => {
  test('substitutes fields; missing/null render blank', () => {
    expect(renderTemplate('Hi <<name>> (<<email>>)', { name: 'Vinita', email: 'v@x.com' })).toBe('Hi Vinita (v@x.com)')
    expect(renderTemplate('Hi <<name>>!', {})).toBe('Hi !')
    expect(renderTemplate('n=<<n>>', { n: 0 })).toBe('n=0')
    expect(renderTemplate('x=<<x>>', { x: null })).toBe('x=')
  })
})

describe('missingPlaceholders', () => {
  test('lists placeholders with no matching field', () => {
    expect(missingPlaceholders('<<a>> <<b>>', ['a'])).toEqual(['b'])
    expect(missingPlaceholders('<<a>>', ['a', 'b'])).toEqual([])
  })
})

describe('isEmail', () => {
  test('basic validation', () => {
    expect(isEmail('a@b.com')).toBe(true)
    expect(isEmail('  a@b.co  ')).toBe(true)
    expect(isEmail('nope')).toBe(false)
    expect(isEmail('a@b')).toBe(false)
    expect(isEmail('')).toBe(false)
  })
})

describe('resolveRecipients', () => {
  test('dedupes (case-insensitive) + skips invalid/missing', () => {
    const rows = [
      { email: 'A@x.com' },
      { email: 'a@x.com' }, // dupe
      { email: 'bad' }, // invalid
      { email: '' }, // missing
      { email: 'b@x.com' },
    ]
    const { valid, skipped } = resolveRecipients(rows, 'email')
    expect(valid.sort()).toEqual(['a@x.com', 'b@x.com'])
    expect(skipped).toBe(3)
  })
})
