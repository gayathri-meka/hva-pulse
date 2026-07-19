// Google Calendar event + Meet link for interview bookings, via the shared Google
// account connected under Settings → Email (same refresh token as Gmail). The
// connected account (academy@…) is the event ORGANIZER; the interviewer + candidate
// are attendees. Google emails the invite (with the Meet link) to all of them.
//
// Needs the calendar.events scope (in GMAIL_SCOPES) + the Calendar API enabled.
// Inert (returns null / false) until an account is connected.

import { getGoogleAccessToken } from './googleMail'

const CAL_BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const IST = 'Asia/Kolkata'
const SLOT_MINUTES = 60

export type InterviewEventInput = {
  candidateEmail: string
  candidateName: string | null
  interviewerEmail: string
  round: 1 | 2
  roundLabel: string // e.g. "Round 1: Motivation"
  scheduledAt: string // ISO
}

function toRfc3339(iso: string): string {
  // Calendar accepts a full RFC3339 timestamp; the stored ISO is UTC ("…Z"),
  // which is unambiguous, so we pass it as-is with the IST display timeZone.
  return new Date(iso).toISOString()
}

/** Create the interview event (with a Meet link) and email all attendees.
 *  Returns { eventId, meetLink } on success, or null if not connected/failed. */
export async function createInterviewEvent(
  input: InterviewEventInput,
): Promise<{ eventId: string; meetLink: string | null } | null> {
  const tok = await getGoogleAccessToken()
  if (!tok) return null

  const start = toRfc3339(input.scheduledAt)
  const end = new Date(new Date(input.scheduledAt).getTime() + SLOT_MINUTES * 60_000).toISOString()
  const who = input.candidateName || input.candidateEmail

  const body = {
    summary: `HVA Interview · ${input.roundLabel} · ${who}`,
    description:
      `HyperVerge Academy admissions interview.\n\nCandidate: ${who} (${input.candidateEmail})\n` +
      `${input.roundLabel}\n\nJoin via the Google Meet link on this invite.`,
    start: { dateTime: start, timeZone: IST },
    end: { dateTime: end, timeZone: IST },
    attendees: [
      { email: input.interviewerEmail },
      { email: input.candidateEmail },
    ],
    conferenceData: {
      createRequest: {
        // Unique-per-event id; caller varies input so this is deterministic enough.
        requestId: `hva-${input.round}-${new Date(input.scheduledAt).getTime()}-${input.candidateEmail}`.slice(0, 100),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    reminders: { useDefault: true },
  }

  try {
    const res = await fetch(`${CAL_BASE}?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return null
    const ev = (await res.json()) as {
      id?: string
      hangoutLink?: string
      conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] }
    }
    if (!ev.id) return null
    const meetLink =
      ev.hangoutLink ??
      ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
      null
    return { eventId: ev.id, meetLink }
  } catch {
    return null
  }
}

/** Move an existing event to a new time (reschedule). Best-effort. */
export async function updateInterviewEventTime(eventId: string, scheduledAt: string): Promise<boolean> {
  const tok = await getGoogleAccessToken()
  if (!tok) return false
  const end = new Date(new Date(scheduledAt).getTime() + SLOT_MINUTES * 60_000).toISOString()
  try {
    const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tok.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: { dateTime: toRfc3339(scheduledAt), timeZone: IST }, end: { dateTime: end, timeZone: IST } }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Cancel/delete an event and notify attendees. Best-effort. */
export async function deleteInterviewEvent(eventId: string): Promise<boolean> {
  const tok = await getGoogleAccessToken()
  if (!tok) return false
  try {
    const res = await fetch(`${CAL_BASE}/${encodeURIComponent(eventId)}?sendUpdates=all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tok.accessToken}` },
    })
    return res.ok || res.status === 410 // 410 = already gone
  } catch {
    return false
  }
}
