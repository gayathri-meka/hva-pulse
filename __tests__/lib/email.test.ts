import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Gmail transport so we test email.ts orchestration without network/DB.
vi.mock('@/lib/googleMail', () => ({
  getGmailSender: vi.fn(),
  buildRawMessage: vi.fn(() => 'RAW'),
  sendRaw: vi.fn(),
}))

import { getGmailSender, sendRaw } from '@/lib/googleMail'
import { sendTemplatedEmails } from '@/lib/email'

const rows = [
  { email: 'a@x.com', name: 'A' },
  { email: 'A@X.com', name: 'A dup' }, // dedupes to a@x.com
  { email: 'not-an-email', name: 'bad' }, // invalid → skipped
  { email: 'b@x.com', name: 'B' },
]

beforeEach(() => vi.clearAllMocks())

describe('sendTemplatedEmails', () => {
  it('dedupes + drops invalid recipients, and reports not-connected when no account', async () => {
    vi.mocked(getGmailSender).mockResolvedValue(null)
    const res = await sendTemplatedEmails({
      rows,
      recipientField: 'email',
      subject: 'Hi <<name>>',
      body: 'Hello <<name>>',
    })
    expect(res.skipped).toBe(2) // the casing-dup + the invalid address
    expect(res.results).toHaveLength(2) // a@x.com, b@x.com
    expect(res.results.every((r) => !r.ok && /Settings → Email/.test(r.error ?? ''))).toBe(true)
    expect(sendRaw).not.toHaveBeenCalled()
  })

  it('sends one Gmail message per unique valid recipient when connected', async () => {
    vi.mocked(getGmailSender).mockResolvedValue({ accessToken: 'tok', from: 'HVA <s@hva.org>' })
    vi.mocked(sendRaw).mockResolvedValue({ ok: true, id: 'msg-1' })
    const res = await sendTemplatedEmails({
      rows,
      recipientField: 'email',
      subject: 'Hi <<name>>',
      body: 'Hello <<name>>',
    })
    expect(res.skipped).toBe(2)
    expect(sendRaw).toHaveBeenCalledTimes(2)
    expect(res.results.map((r) => r.to)).toEqual(['a@x.com', 'b@x.com'])
    expect(res.results.every((r) => r.ok)).toBe(true)
  })

  it('surfaces a per-recipient send failure', async () => {
    vi.mocked(getGmailSender).mockResolvedValue({ accessToken: 'tok', from: 'HVA <s@hva.org>' })
    vi.mocked(sendRaw).mockResolvedValueOnce({ ok: true, id: '1' }).mockResolvedValueOnce({ ok: false, error: 'Gmail 429: rate' })
    const res = await sendTemplatedEmails({ rows, recipientField: 'email', subject: 's', body: 'b' })
    expect(res.results[0].ok).toBe(true)
    expect(res.results[1]).toMatchObject({ ok: false, error: expect.stringContaining('Gmail 429') })
  })
})
