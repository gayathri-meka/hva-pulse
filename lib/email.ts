// Email sending via the Gmail API, using the single shared Google account
// connected under Settings → Email (see lib/googleMail.ts + migrations/062).
// Same public API as before, so callers (sendEmailCampaign) are unchanged.

import { renderTemplate, isEmail } from './emailTemplate'
import { getGmailSender, buildRawMessage, sendRaw } from './googleMail'

const NOT_CONNECTED = 'Email is not configured — connect a Google account under Settings → Email.'

export type SendOutcome = { to: string; ok: boolean; id?: string; error?: string }

/** Send one email. Used for the "send a test to myself" path. */
export async function sendEmail(opts: {
  to: string
  subject: string
  text: string
  replyTo?: string
}): Promise<SendOutcome> {
  const sender = await getGmailSender()
  if (!sender) return { to: opts.to, ok: false, error: NOT_CONNECTED }
  const raw = buildRawMessage({ from: sender.from, to: opts.to, subject: opts.subject, text: opts.text, replyTo: opts.replyTo })
  const r = await sendRaw(sender.accessToken, raw)
  return { to: opts.to, ...r }
}

export type TemplatedSendResult = { results: SendOutcome[]; skipped: number }

/**
 * Render a subject/body template per row and send one personalised email each,
 * deduped by recipient and validated. Sent via Gmail (one message per recipient).
 * Returns a per-recipient outcome list so the caller can log + report.
 */
export async function sendTemplatedEmails(params: {
  rows: Record<string, unknown>[]
  recipientField: string
  subject: string
  body: string
  replyTo?: string
}): Promise<TemplatedSendResult> {
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

  const sender = await getGmailSender()
  if (!sender) {
    return { results: queue.map((q) => ({ to: q.to, ok: false, error: NOT_CONNECTED })), skipped }
  }

  // Gmail has no batch send — send sequentially, one message per recipient.
  const results: SendOutcome[] = []
  for (const q of queue) {
    const raw = buildRawMessage({ from: sender.from, to: q.to, subject: q.subject, text: q.text, replyTo: params.replyTo })
    const r = await sendRaw(sender.accessToken, raw)
    results.push({ to: q.to, ...r })
  }
  return { results, skipped }
}
