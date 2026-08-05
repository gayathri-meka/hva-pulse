'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'
import { canActOnTicket } from '@/lib/tickets'

// hva-pulse never calls Slack directly — reply/close/reopen/edit POST to the shared edge function
// (hva-automation `hva-slack-router`), which does the Slack work and updates Postgres. We
// authenticate with a shared secret (HVA_PULSE_EDGE_SECRET), not a Slack signature. The edge URL is
// derived from the Supabase project URL (the function name is fixed). Read lazily per call.
function edgeConfig(): { url: string; secret: string } {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return {
    url: base ? `${base}/functions/v1/hva-slack-router` : '',
    secret: process.env.HVA_PULSE_EDGE_SECRET || '',
  }
}

type Result = { ok: boolean; error?: string }

// Loads the ticket's gating fields and confirms the caller may act on it. Returns an error Result
// to surface, or { ok: true } when allowed.
async function assertCanAct(
  ticketId: string,
): Promise<{ error: Result } | { ok: true }> {
  const user = await requireStaff()
  const supabase = await createServerSupabaseClient()
  const { data: ticket } = await supabase
    .from('tickets')
    .select('spoc_emails')
    .eq('ticket_id', ticketId)
    .maybeSingle()

  if (!ticket) return { error: { ok: false, error: 'Ticket not found.' } }
  if (!canActOnTicket(user, ticket as { spoc_emails: string[] })) {
    return { error: { ok: false, error: 'Only an assigned SPOC or an admin can act on this ticket.' } }
  }
  return { ok: true }
}

async function postToEdge(payload: Record<string, unknown>): Promise<Result> {
  const { url, secret } = edgeConfig()
  if (!url || !secret) {
    return { ok: false, error: 'Ticket actions are not configured (missing edge URL / secret).' }
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source: 'pulse', secret, ...payload }),
    })
    const json = (await res.json().catch(() => ({}))) as Result
    if (!res.ok || !json.ok) {
      return { ok: false, error: json.error || `Edge returned HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

// Reply to the requester (or post an internal team note). FormData so a file attachment can ride
// along. Fields: ticketId, body, toSide ('requester'|'team'), attachment (File, optional).
export async function replyToTicket(formData: FormData): Promise<Result> {
  const user = await requireStaff()
  const ticketId = String(formData.get('ticketId') || '')
  const body = String(formData.get('body') || '').trim()
  const toSide = String(formData.get('toSide') || 'requester') === 'team' ? 'team' : 'requester'
  if (!ticketId) return { ok: false, error: 'Missing ticket.' }
  if (!body) return { ok: false, error: 'Reply cannot be empty.' }

  const gate = await assertCanAct(ticketId)
  if ('error' in gate) return gate.error

  let attachmentBase64: string | undefined
  let attachmentName: string | undefined
  const file = formData.get('attachment')
  if (file && typeof file === 'object' && 'arrayBuffer' in file && (file as File).size > 0) {
    const f = file as File
    // Cap the size — the file rides to the edge as base64 in a JSON body; huge files would bloat it.
    const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
    if (f.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: 'Attachment is too large (max 10 MB). Share it in the Slack thread instead.' }
    }
    const buf = Buffer.from(await f.arrayBuffer())
    attachmentBase64 = buf.toString('base64')
    attachmentName = f.name
  }

  const result = await postToEdge({
    action: 'reply',
    ticketId,
    body,
    toSide,
    actorEmail: user.email,
    actorName: user.name || user.email,
    attachmentBase64,
    attachmentName,
  })
  if (result.ok) {
    revalidatePath('/tickets')
    revalidatePath(`/tickets/${ticketId}`)
  }
  return result
}

export async function closeTicket(ticketId: string): Promise<Result> {
  const user = await requireStaff()
  const gate = await assertCanAct(ticketId)
  if ('error' in gate) return gate.error

  const result = await postToEdge({ action: 'close', ticketId, actorEmail: user.email, actorName: user.name || user.email })
  if (result.ok) {
    revalidatePath('/tickets')
    revalidatePath(`/tickets/${ticketId}`)
  }
  return result
}

export async function reopenTicket(ticketId: string): Promise<Result> {
  const user = await requireStaff()
  const gate = await assertCanAct(ticketId)
  if ('error' in gate) return gate.error

  const result = await postToEdge({ action: 'reopen', ticketId, actorEmail: user.email, actorName: user.name || user.email })
  if (result.ok) {
    revalidatePath('/tickets')
    revalidatePath(`/tickets/${ticketId}`)
  }
  return result
}

export async function editTicket(
  ticketId: string,
  fields: { category?: string; priority?: string; spoc_emails?: string[] },
): Promise<Result> {
  const user = await requireStaff()
  const gate = await assertCanAct(ticketId)
  if ('error' in gate) return gate.error

  const result = await postToEdge({ action: 'edit', ticketId, fields, actorEmail: user.email, actorName: user.name || user.email })
  if (result.ok) {
    revalidatePath('/tickets')
    revalidatePath(`/tickets/${ticketId}`)
  }
  return result
}
