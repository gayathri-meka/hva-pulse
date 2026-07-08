import { describe, it, expect } from 'vitest'
import { buildRawMessage, emailFromIdToken } from '@/lib/googleMail'

const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8')

describe('buildRawMessage', () => {
  it('builds a base64url MIME message with the expected headers and body', () => {
    const raw = buildRawMessage({ from: 'HVA <a@b.com>', to: 'x@y.com', subject: 'Hi', text: 'Hello there' })
    const msg = decode(raw)
    expect(msg).toContain('From: HVA <a@b.com>')
    expect(msg).toContain('To: x@y.com')
    expect(msg).toContain('Subject: Hi')
    expect(msg).toContain('Content-Transfer-Encoding: base64')
    // Body is base64 after the blank line.
    const body = msg.split('\r\n\r\n')[1]
    expect(Buffer.from(body, 'base64').toString('utf8')).toBe('Hello there')
  })

  it('includes Reply-To only when provided', () => {
    expect(decode(buildRawMessage({ from: 'a', to: 'b', subject: 's', text: 't', replyTo: 'r@x.com' }))).toContain('Reply-To: r@x.com')
    expect(decode(buildRawMessage({ from: 'a', to: 'b', subject: 's', text: 't' }))).not.toContain('Reply-To:')
  })

  it('RFC 2047-encodes a non-ASCII subject', () => {
    const msg = decode(buildRawMessage({ from: 'a', to: 'b', subject: 'Café ☕', text: 't' }))
    const line = msg.split('\r\n').find((l) => l.startsWith('Subject:'))!
    expect(line).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/)
    // The encoded word decodes back to the original subject.
    const b64 = line.replace('Subject: =?UTF-8?B?', '').replace('?=', '')
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe('Café ☕')
  })

  it('preserves unicode in the body', () => {
    const msg = decode(buildRawMessage({ from: 'a', to: 'b', subject: 's', text: 'नमस्ते 🙏' }))
    const body = msg.split('\r\n\r\n')[1]
    expect(Buffer.from(body, 'base64').toString('utf8')).toBe('नमस्ते 🙏')
  })
})

describe('emailFromIdToken', () => {
  const jwt = (payload: object) =>
    `header.${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')}.sig`

  it('extracts a lowercased email from the JWT payload', () => {
    expect(emailFromIdToken(jwt({ email: 'Admissions@HVA.org' }))).toBe('admissions@hva.org')
  })

  it('returns null for missing / malformed tokens', () => {
    expect(emailFromIdToken(undefined)).toBeNull()
    expect(emailFromIdToken('not-a-jwt')).toBeNull()
    expect(emailFromIdToken(jwt({ sub: '123' }))).toBeNull() // no email claim
  })
})
