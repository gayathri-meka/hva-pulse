import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'
import {
  type Ticket,
  type TicketEvent,
  type SpocUser,
  STATUS_STYLE,
  STATUS_LABEL,
  priorityStyle,
  spocName,
  ratingDisplay,
} from '@/lib/tickets'

export const dynamic = 'force-dynamic'

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function TicketDetailPage({ params }: { params: Promise<{ ticketId: string }> }) {
  const user = await requireStaff()
  if (!user) redirect('/login')

  const { ticketId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: ticketData } = await supabase.from('tickets').select('*').eq('ticket_id', ticketId).maybeSingle()
  if (!ticketData) notFound()
  const ticket = ticketData as Ticket

  const [{ data: eventData }, { data: spocData }] = await Promise.all([
    supabase.from('ticket_events').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true }),
    supabase.from('users').select('email, name').in('role', ['admin', 'staff']),
  ])
  const events = (eventData ?? []) as TicketEvent[]
  const roster = (spocData ?? []) as Pick<SpocUser, 'email' | 'name'>[]

  return (
    <div className="max-w-3xl">
      <Link href="/tickets" className="text-sm text-zinc-500 hover:text-zinc-700">← Back to tickets</Link>

      <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold text-zinc-900">{ticket.title || '(untitled)'}</h1>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[ticket.status]}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span className={`rounded-full px-2 py-0.5 font-medium ${priorityStyle(ticket.priority)}`}>{ticket.priority}</span>
          <span>{ticket.category}</span>
          <span>·</span>
          <span>Raised by {ticket.raiser_name || ticket.raiser_email || '—'}</span>
          {ticket.is_test && <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">TEST</span>}
        </div>

        {ticket.description && (
          <p className="mt-4 whitespace-pre-wrap border-l-2 border-zinc-100 pl-3 text-sm text-zinc-700">{ticket.description}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
          <span>SPOCs: {(ticket.spoc_emails || []).map((e) => spocName(e, roster)).join(', ') || 'unassigned'}</span>
          {ticket.attachment_url && <a href={ticket.attachment_url} target="_blank" rel="noreferrer" className="text-[#5BAE5B] hover:underline">📎 Attachment</a>}
          <span>Reminders sent: {ticket.reminder_count}</span>
          {ticket.closed_at && <span>Closed {fmtDateTime(ticket.closed_at)}{ticket.closed_by_email ? ` by ${ticket.closed_by_email}` : ''}</span>}
        </div>

        {ratingDisplay(ticket.rating) && (
          <div className="mt-4 rounded-lg bg-zinc-50 px-4 py-3">
            <div className="text-xs font-medium text-zinc-500">Requester feedback</div>
            <div className="mt-1 text-sm text-zinc-800">
              {ratingDisplay(ticket.rating)!.emoji} {ratingDisplay(ticket.rating)!.label}
            </div>
            {ticket.feedback && <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">“{ticket.feedback}”</p>}
          </div>
        )}
      </div>

      {/* Conversation lives in Slack */}
      <div className="mt-6 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        💬 The full conversation (team ↔ requester) is in the <span className="font-medium">Slack thread</span> — reply from there or use the <span className="font-medium">Reply</span> action on the tickets list. Replies aren&apos;t stored in Pulse.
      </div>

      {/* Audit log */}
      {events.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-zinc-700">Activity</h2>
          <ul className="space-y-1 text-xs text-zinc-500">
            {events.map((e) => (
              <li key={e.id}>
                <span className="font-medium text-zinc-700">{e.action}</span>
                {e.actor_email ? ` by ${e.actor_email}` : ''} <span className="text-zinc-400">({e.actor_source})</span> · {fmtDateTime(e.created_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
