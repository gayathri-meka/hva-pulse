'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createColumnHelper } from '@tanstack/react-table'
import DataTable from '@/components/ui/DataTable'
import Tooltip from '@/components/ui/Tooltip'
import Modal from '@/components/placements/Modal'
import {
  type Ticket,
  type TicketStatus,
  type TicketCategory,
  type SpocUser,
  STATUS_STYLE,
  STATUS_LABEL,
  priorityStyle,
  spocName,
  ratingDisplay,
  TICKET_PRIORITIES,
} from '@/lib/tickets'
import { replyToTicket, closeTicket, reopenTicket, editTicket } from './actions'

type TicketRow = Ticket & { canAct: boolean }

function StatusChip({ status }: { status: TicketStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function PriorityChip({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityStyle(priority)}`}>
      {priority}
    </span>
  )
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

const col = createColumnHelper<TicketRow>()

export default function TicketsTable({ rows, categories, spocs }: {
  rows: TicketRow[]
  categories: TicketCategory[]
  spocs: SpocUser[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTest, setShowTest] = useState(false)

  // Modal state: which action, on which ticket.
  const [replyFor, setReplyFor] = useState<TicketRow | null>(null)
  const [editFor, setEditFor] = useState<TicketRow | null>(null)
  const [confirmFor, setConfirmFor] = useState<{ ticket: TicketRow; kind: 'close' | 'reopen' } | null>(null)

  const data = useMemo(() => (showTest ? rows : rows.filter((r) => !r.is_test)), [rows, showTest])

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError(null)
    setSaving(true)
    try {
      const res = await fn()
      if (!res.ok) { setError(res.error || 'Something went wrong.'); return }
      onDone?.()
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const columns = useMemo(() => [
    col.accessor('title', {
      header: 'Ticket',
      cell: (c) => (
        <Link href={`/tickets/${c.row.original.ticket_id}`} className="font-medium text-zinc-900 hover:text-[#5BAE5B]">
          {c.getValue() || '(untitled)'}
        </Link>
      ),
      enableHiding: false,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (c) => <StatusChip status={c.getValue()} />,
    }),
    col.accessor('priority', {
      header: 'Priority',
      cell: (c) => <PriorityChip priority={c.getValue()} />,
    }),
    col.accessor('category', { header: 'Category' }),
    col.accessor((r) => r.raiser_name || r.raiser_email || '—', {
      id: 'raiser',
      header: 'Raised by',
    }),
    col.accessor((r) => (r.spoc_emails || []).map((e) => spocName(e, spocs)).join(', ') || '—', {
      id: 'spocs',
      header: 'SPOCs',
    }),
    col.accessor((r) => fmtDate(r.created_at), {
      id: 'created_at',
      header: 'Created',
      enableColumnFilter: false,
      sortingFn: (a, b) => new Date(a.original.created_at).getTime() - new Date(b.original.created_at).getTime(),
    }),
    col.accessor((r) => { const d = ratingDisplay(r.rating); return d ? `${d.emoji} ${d.label}` : '—' }, {
      id: 'rating',
      header: 'CSAT',
      cell: (c) => {
        const d = ratingDisplay(c.row.original.rating)
        if (!d) return <span className="text-zinc-300">—</span>
        const fb = c.row.original.feedback
        const chip = (
          <span className="inline-flex items-center gap-1">
            {d.emoji} <span className="text-[11px] text-zinc-500">{d.label}</span>
            {fb && <span className="text-[11px] leading-none" aria-label="has a comment" title="">💬</span>}
          </span>
        )
        // The 💬 flags that a comment exists; hover = preview; the full comment is on the ticket page.
        return fb ? <Tooltip content={<span className="italic">“{fb}”</span>}>{chip}</Tooltip> : chip
      },
    }),
    col.display({
      id: 'actions',
      header: 'Actions',
      enableHiding: false,
      size: 210,
      meta: { compact: true },
      cell: (c) => {
        const t = c.row.original
        if (!t.canAct) return <span className="block text-center text-[11px] text-zinc-400">View only</span>
        return (
          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <button onClick={() => setReplyFor(t)} className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Reply</button>
            <button onClick={() => setEditFor(t)} className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Edit</button>
            {t.status === 'closed'
              ? <button onClick={() => setConfirmFor({ ticket: t, kind: 'reopen' })} className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50">Reopen</button>
              : <button onClick={() => setConfirmFor({ ticket: t, kind: 'close' })} className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50">Close</button>}
          </div>
        )
      },
    }),
  ], [])

  return (
    <>
      {error && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <DataTable
        data={data}
        columns={columns}
        storageKey="tickets"
        searchKeys={['title', 'category', 'raiser', 'spocs']}
        searchPlaceholder="Search tickets…"
        csvFilename="tickets"
        pinnedLeft={['title']}
        pinnedRight={['actions']}
        initialSorting={[{ id: 'created_at', desc: true }]}
        emptyMessage="No tickets yet."
        toolbarLeft={
          <label className="flex items-center gap-1.5 text-xs text-zinc-500">
            <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} className="rounded border-zinc-300" />
            Show test tickets
          </label>
        }
      />

      {replyFor && (
        <ReplyModal ticket={replyFor} pending={saving} onClose={() => setReplyFor(null)}
          onSubmit={(fd) => run(() => replyToTicket(fd), () => setReplyFor(null))} />
      )}

      {editFor && (
        <EditModal ticket={editFor} categories={categories} spocs={spocs} pending={saving} onClose={() => setEditFor(null)}
          onSubmit={(fields) => run(() => editTicket(editFor!.ticket_id, fields), () => setEditFor(null))} />
      )}

      {confirmFor && (
        <Modal title={confirmFor.kind === 'close' ? 'Close ticket?' : 'Reopen ticket?'} onClose={() => setConfirmFor(null)}>
          <p className="text-sm text-zinc-600">
            {confirmFor.kind === 'close'
              ? 'The requester is notified in Slack. A reply reopens it.'
              : 'This reopens the ticket and resumes reminders.'}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-900">{confirmFor.ticket.title}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setConfirmFor(null)} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
            <button
              disabled={saving}
              onClick={() => run(
                () => (confirmFor.kind === 'close' ? closeTicket(confirmFor.ticket.ticket_id) : reopenTicket(confirmFor.ticket.ticket_id)),
                () => setConfirmFor(null),
              )}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${confirmFor.kind === 'close' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#5BAE5B] hover:brightness-95'}`}
            >
              {saving ? 'Working…' : confirmFor.kind === 'close' ? 'Close ticket' : 'Reopen'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

function ReplyModal({ ticket, pending, onClose, onSubmit }: {
  ticket: TicketRow; pending: boolean; onClose: () => void; onSubmit: (fd: FormData) => void
}) {
  const [body, setBody] = useState('')
  const [toSide, setToSide] = useState<'requester' | 'team'>('requester')
  const [file, setFile] = useState<File | null>(null)

  function submit() {
    const fd = new FormData()
    fd.set('ticketId', ticket.ticket_id)
    fd.set('body', body)
    fd.set('toSide', toSide)
    if (file) fd.set('attachment', file)
    onSubmit(fd)
  }

  return (
    <Modal title={`Reply · ${ticket.title}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex gap-1.5 text-xs">
          {(['requester', 'team'] as const).map((s) => (
            <button key={s} onClick={() => setToSide(s)}
              className={`rounded-md px-2.5 py-1 font-medium ${toSide === s ? 'bg-zinc-900 text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
              {s === 'requester' ? 'To requester' : 'Internal note'}
            </button>
          ))}
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} autoFocus
          placeholder={toSide === 'requester' ? 'Reply the requester will see in Slack…' : 'Internal note visible only in the team channel…'}
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-[#5BAE5B] focus:outline-none" />
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-xs file:font-medium" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
          <button disabled={pending || !body.trim()} onClick={submit}
            className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50">
            {pending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function EditModal({ ticket, categories, spocs: roster, pending, onClose, onSubmit }: {
  ticket: TicketRow; categories: TicketCategory[]; spocs: SpocUser[]; pending: boolean; onClose: () => void; onSubmit: (fields: { category?: string; priority?: string; spoc_emails?: string[] }) => void
}) {
  const [category, setCategory] = useState(ticket.category)
  const [priority, setPriority] = useState(ticket.priority)
  const [spocEmails, setSpocEmails] = useState<string[]>(ticket.spoc_emails || [])

  const has = (email: string) => spocEmails.some((e) => e.toLowerCase() === email.toLowerCase())
  // Include the ticket's current category even if it's since been deactivated/renamed.
  const categoryNames = Array.from(new Set([...categories.filter((c) => c.active).map((c) => c.name), category])).filter(Boolean)

  function toggleSpoc(email: string) {
    setSpocEmails((cur) => (has(email) ? cur.filter((e) => e.toLowerCase() !== email.toLowerCase()) : [...cur, email]))
  }

  return (
    <Modal title={`Edit · ${ticket.title}`} onClose={onClose}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm">
            {TICKET_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-zinc-500">Assigned SPOCs</span>
          <div className="flex flex-wrap gap-1.5">
            {roster.map((s) => (
              <button key={s.id} onClick={() => toggleSpoc(s.email)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${has(s.email) ? 'bg-[#5BAE5B] text-white' : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-50'}`}>
                {s.name || s.email}
              </button>
            ))}
            {roster.length === 0 && <span className="text-xs text-zinc-400">No admin/staff users found.</span>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">Cancel</button>
          <button disabled={pending} onClick={() => onSubmit({ category, priority, spoc_emails: spocEmails })}
            className="rounded-lg bg-[#5BAE5B] px-3 py-1.5 text-sm font-medium text-white hover:brightness-95 disabled:opacity-50">
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
