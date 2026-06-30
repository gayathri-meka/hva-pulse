// Email sending via Resend (https://resend.com) — REST API over fetch, no SDK.
// Requires RESEND_API_KEY and a verified sending domain. EMAIL_FROM sets the
// From address (must be on the verified domain).

import { renderTemplate, isEmail } from './emailTemplate'

const ENDPOINT = 'https://api.resend.com/emails'
const BATCH_ENDPOINT = 'https://api.resend.com/emails/batch'

function fromAddress(): string {
  return process.env.EMAIL_FROM || 'HyperVerge Academy <no-reply@academy.hyperverge.org>'
}

export type SendOutcome = { to: string; ok: boolean; id?: string; error?: string }

/** Send one email. Used for the "send a test to myself" path. */
export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  replyTo?: string
}): Promise<SendOutcome> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { to: opts.to, ok: false, error: 'Email is not configured (RESEND_API_KEY missing).' }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddress(), to: opts.to, subject: opts.subject, text: opts.text, reply_to: opts.replyTo }),
    })
    if (!res.ok) return { to: opts.to, ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }
    const data = (await res.json().catch(() => ({}))) as { id?: string }
    return { to: opts.to, ok: true, id: data?.id }
  } catch (e) {
    return { to: opts.to, ok: false, error: String((e as Error)?.message ?? e) }
  }
}

export type TemplatedSendResult = { results: SendOutcome[]; skipped: number }

/**
 * Render a subject/body template per row and send one personalised email each,
 * deduped by recipient and validated. Batched through Resend (100/request).
 * Returns a per-recipient outcome list so the caller can log + report.
 */
export async function sendTemplatedEmails(params: {
  rows: Record<string, unknown>[]
  recipientField: string
  subject: string
  body: string
  replyTo?: string
}): Promise<TemplatedSendResult> {
  const key = process.env.RESEND_API_KEY
  const seen = new Set<string>()
  const queue: { to: string; subject: string; text: string }[] = []
  let skipped = 0

  for (const row of params.rows) {
    const to = String(row[params.recipientField] ?? '').trim().toLowerCase()
    if (!isEmail(to) || seen.has(to)) {
      skipped++
      continue
    }
    seen.add(to)
    queue.push({
      to,
      subject: renderTemplate(params.subject, row),
      text: renderTemplate(params.body, row),
    })
  }

  if (!key) {
    return { results: queue.map((q) => ({ to: q.to, ok: false, error: 'Email is not configured (RESEND_API_KEY missing).' })), skipped }
  }

  const results: SendOutcome[] = []
  const CHUNK = 100
  for (let i = 0; i < queue.length; i += CHUNK) {
    const chunk = queue.slice(i, i + CHUNK)
    try {
      const res = await fetch(BATCH_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(
          chunk.map((c) => ({ from: fromAddress(), to: [c.to], subject: c.subject, text: c.text, reply_to: params.replyTo })),
        ),
      })
      if (!res.ok) {
        const err = `Resend ${res.status}: ${(await res.text()).slice(0, 200)}`
        for (const c of chunk) results.push({ to: c.to, ok: false, error: err })
        continue
      }
      const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }[] }
      chunk.forEach((c, j) => results.push({ to: c.to, ok: true, id: data?.data?.[j]?.id }))
    } catch (e) {
      const err = String((e as Error)?.message ?? e)
      for (const c of chunk) results.push({ to: c.to, ok: false, error: err })
    }
  }
  return { results, skipped }
}
