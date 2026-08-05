// Tech Support tickets — shared types + pure helpers.
//
// Tickets are raised via the /tech-support Slack flow (handled by the hva-automation edge
// function) and stored in Postgres (migration 088). This app reads them and routes reply/close/
// reopen/edit actions back through the edge. Permission gating and display styling live here so
// they're unit-testable and shared between the list, detail, and table.

export type TicketStatus = 'open' | 'closed' | 'escalated'

export type Ticket = {
  id: string
  ticket_id: string
  category: string
  priority: string
  title: string
  description: string | null
  raiser_slack_id: string | null
  raiser_name: string | null
  raiser_email: string | null
  spocs: string[]
  spoc_emails: string[]
  status: TicketStatus
  channel_id: string | null
  channel_ts: string | null
  attachment_url: string | null
  is_test: boolean
  reminder_count: number
  escalated: boolean
  last_reminded_at: string | null
  reminders_muted: boolean
  closed_by_email: string | null
  closed_at: string | null
  rating: number | null
  feedback: string | null
  created_at: string
  updated_at: string
}

// Requester CSAT rating shown after close. 1 = bad, 2 = okay, 3 = great.
export function ratingDisplay(rating: number | null): { emoji: string; label: string } | null {
  if (rating === 1) return { emoji: '😞', label: 'Not great' }
  if (rating === 2) return { emoji: '😐', label: 'Okay' }
  if (rating === 3) return { emoji: '😄', label: 'Great' }
  return null
}

export type TicketEvent = {
  id: string
  ticket_id: string
  action: string
  actor_email: string | null
  actor_source: string
  details: Record<string, unknown> | null
  created_at: string
}

// Categories are DB-driven (ticket_categories, migration 088) so admins can edit them from
// Pulse and the Slack modal picks up the change with no redeploy. A category's SPOCs are the app's
// admin/staff USERS, referenced by email (migration 088).
export type TicketCategory = {
  id: string
  name: string
  spoc_emails: string[]
  sort_order: number
  active: boolean
}

// A user who can be a SPOC — sourced from public.users where role in ('admin','staff').
export type SpocUser = {
  id: string
  email: string
  name: string | null
  role: string
}

// Priorities are a fixed scale (not a roster), so they stay a constant.
export const TICKET_PRIORITIES = ['Low', 'Medium', 'High'] as const

// Resolves a SPOC email to a display name using the admin/staff user list; falls back to the email.
export function spocName(email: string, users: Pick<SpocUser, 'email' | 'name'>[] = []): string {
  const match = users.find((u) => (u.email || '').toLowerCase() === (email || '').toLowerCase())
  return match?.name || email
}

/**
 * Who may act (reply / close / reopen / edit) on a ticket from Pulse:
 *   - any admin, OR
 *   - an assigned SPOC of this ticket (matched by email).
 * Everyone else with page access (staff/guest) is view-only.
 */
export function canActOnTicket(
  user: { email: string; role: string },
  ticket: Pick<Ticket, 'spoc_emails'>,
): boolean {
  if (user.role === 'admin') return true
  const email = (user.email || '').trim().toLowerCase()
  if (!email) return false
  return (ticket.spoc_emails || []).map((e) => (e || '').toLowerCase()).includes(email)
}

// ── Display styling ─────────────────────────────────────────────────────────────
// Semantic status colours: Open = red (needs attention), Escalated = solid red (more severe, so it
// stands out from Open), Closed = green (resolved/done).
export const STATUS_STYLE: Record<TicketStatus, string> = {
  open: 'bg-red-50 text-red-700',
  escalated: 'bg-red-600 text-white',
  closed: 'bg-emerald-50 text-emerald-700',
}
export const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open',
  escalated: 'Escalated',
  closed: 'Closed',
}

export function priorityStyle(priority: string): string {
  if (priority === 'High') return 'bg-red-50 text-red-700'
  if (priority === 'Medium') return 'bg-amber-50 text-amber-700'
  return 'bg-emerald-50 text-emerald-700'
}
