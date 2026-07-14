// Interview booking notifications. Phase A sends a plain confirmation email to
// both parties via the shared Gmail account (needs no extra scope). The calendar
// invite + Google Meet link is layered on in a follow-up once the shared account
// has been re-consented with the calendar scope.

import { getGmailSender, buildRawMessage, sendRaw } from './googleMail'
import { roundLabel, type InterviewRound } from './interviews'

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  })
}

/** Best-effort confirmation emails to candidate + interviewer. Never throws. */
export async function sendBookingEmails(input: {
  candidateEmail: string
  candidateName?: string | null
  interviewerEmail: string
  interviewerName?: string | null
  round: InterviewRound
  scheduledAt: string
  meetLink?: string | null
}): Promise<{ sent: boolean }> {
  try {
    const sender = await getGmailSender()
    if (!sender) return { sent: false } // no connected account → skip silently

    const when = whenLabel(input.scheduledAt)
    const meetLine = input.meetLink ? `\n\nGoogle Meet: ${input.meetLink}` : '\n\nA calendar invite with the video link will follow.'

    const candidateBody =
      `Hi ${input.candidateName || 'there'},\n\n` +
      `Your ${roundLabel(input.round)} interview with HyperVerge Academy is confirmed for:\n${when}${meetLine}\n\n` +
      `See you then!\nHyperVerge Academy`
    const interviewerBody =
      `Hi ${input.interviewerName || 'there'},\n\n` +
      `An interview has been booked into your availability:\n` +
      `Candidate: ${input.candidateName || input.candidateEmail}\nRound: ${roundLabel(input.round)}\nWhen: ${when}${meetLine}\n\n` +
      `HyperVerge Academy`

    for (const [to, subject, text] of [
      [input.candidateEmail, `Your HVA interview is confirmed — ${when}`, candidateBody],
      [input.interviewerEmail, `Interview booked — ${input.candidateName || input.candidateEmail} (${roundLabel(input.round)})`, interviewerBody],
    ] as const) {
      const raw = buildRawMessage({ from: sender.from, to, subject, text })
      await sendRaw(sender.accessToken, raw)
    }
    return { sent: true }
  } catch {
    return { sent: false }
  }
}
