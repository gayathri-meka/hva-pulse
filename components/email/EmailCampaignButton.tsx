'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { renderTemplate, missingPlaceholders, resolveRecipients } from '@/lib/emailTemplate'

export type CampaignPayload = {
  subject: string
  body: string
  recipientField: string
  rows: Record<string, unknown>[]
  test?: { to: string }
  campaign?: string
}
export type CampaignResult =
  | { ok: true; sent: number; failed: number; skipped: number; error?: string }
  | { ok: false; error: string }
export type EmailCampaignAction = (payload: CampaignPayload) => Promise<CampaignResult>

// Reusable mail-merge composer. Drop it next to any table: pass the rows, the
// available placeholder fields, the current admin's email (for the test send),
// and a server action that performs the send.
export default function EmailCampaignButton({
  rows,
  fields,
  defaultRecipientField,
  currentUserEmail,
  action,
  campaign,
  label = 'Email campaign',
  title = 'Send a templated email',
}: {
  rows: Record<string, unknown>[]
  fields: string[]
  defaultRecipientField?: string
  currentUserEmail: string
  action: EmailCampaignAction
  campaign?: string
  label?: string
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const [recipientField, setRecipientField] = useState(
    defaultRecipientField ?? (fields.includes('email') ? 'email' : fields[0] ?? ''),
  )
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [lastFocused, setLastFocused] = useState<'subject' | 'body'>('body')
  const [testTo, setTestTo] = useState(currentUserEmail)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [pending, startTransition] = useTransition()

  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const recipients = useMemo(() => resolveRecipients(rows, recipientField), [rows, recipientField])
  const missing = useMemo(
    () => Array.from(new Set([...missingPlaceholders(subject, fields), ...missingPlaceholders(body, fields)])),
    [subject, body, fields],
  )
  const sample = rows[0] ?? {}

  function insertField(f: string) {
    const token = `<<${f}>>`
    const el = lastFocused === 'subject' ? subjectRef.current : bodyRef.current
    const setter = lastFocused === 'subject' ? setSubject : setBody
    if (!el) { setter((v) => v + token); return }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? start
    setter(el.value.slice(0, start) + token + el.value.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  function run(payload: CampaignPayload) {
    setResult(null)
    startTransition(async () => {
      try {
        setResult(await action(payload))
      } catch (e) {
        setResult({ ok: false, error: String((e as Error)?.message ?? e) })
      }
    })
  }

  const base = { subject, body, recipientField, campaign }
  const canSend = !!subject.trim() && !!body.trim() && recipients.valid.length > 0

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50"
        title={label}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#5BAE5B]">
          <path d="M3 4a2 2 0 0 0-2 2v.4l9 4.5 9-4.5V6a2 2 0 0 0-2-2H3Z" />
          <path d="m19 8.6-9 4.5-9-4.5V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.6Z" />
        </svg>
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
                <p className="text-xs text-zinc-400">{recipients.valid.length} recipient{recipients.valid.length === 1 ? '' : 's'}{recipients.skipped ? ` · ${recipients.skipped} skipped (no/dupe email)` : ''}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {/* Recipient field */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-600">Recipient column</label>
                <select
                  value={recipientField}
                  onChange={(e) => setRecipientField(e.target.value)}
                  className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-[#5BAE5B] focus:outline-none"
                >
                  {fields.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Placeholder chips */}
              <div className="flex flex-wrap gap-1">
                <span className="text-[11px] text-zinc-400">Insert:</span>
                {fields.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => insertField(f)}
                    className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-200"
                  >
                    {`<<${f}>>`}
                  </button>
                ))}
              </div>

              <input
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => setLastFocused('subject')}
                placeholder="Subject — e.g. Hi <<name>>, your challenge starts soon"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
              />
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onFocus={() => setLastFocused('body')}
                rows={7}
                placeholder={"Body — e.g.\nHey <<name>>,\n\nWe noticed you signed up…"}
                className="w-full resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
              />

              {missing.length > 0 && (
                <p className="text-[11px] text-amber-600">⚠ These placeholders don&apos;t match a column and will render blank: {missing.map((m) => `<<${m}>>`).join(', ')}</p>
              )}

              {/* Preview */}
              {(subject || body) && (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 p-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Preview (first row)</p>
                  <p className="text-xs font-semibold text-zinc-800">{renderTemplate(subject, sample) || <span className="text-zinc-400">(no subject)</span>}</p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600">{renderTemplate(body, sample)}</p>
                </div>
              )}

              {result && (
                result.ok ? (
                  <div className={`rounded-lg px-3 py-2 text-xs ${result.failed ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                    {result.failed ? '⚠' : '✓'} {result.sent} sent{result.failed ? `, ${result.failed} failed` : ''}{result.skipped ? `, ${result.skipped} skipped` : ''}.
                    {result.error && <div className="mt-1 break-words text-amber-700">{result.error}</div>}
                  </div>
                ) : (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{result.error}</p>
                )
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-5 py-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="test recipient"
                  className="w-44 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 placeholder:text-zinc-400 focus:border-[#5BAE5B] focus:outline-none"
                />
                <button
                  onClick={() => run({ ...base, rows, test: { to: testTo.trim() } })}
                  disabled={pending || !subject.trim() || !body.trim() || !testTo.trim()}
                  className="whitespace-nowrap rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                >
                  {pending ? '…' : 'Send test'}
                </button>
              </div>

              {confirming ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Send to {recipients.valid.length}?</span>
                  <button onClick={() => setConfirming(false)} className="text-xs text-zinc-400 hover:text-zinc-700">Cancel</button>
                  <button
                    onClick={() => { setConfirming(false); run({ ...base, rows }) }}
                    disabled={pending}
                    className="rounded-lg bg-[#5BAE5B] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#4e9d4e] disabled:opacity-40"
                  >
                    {pending ? 'Sending…' : 'Confirm send'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  disabled={!canSend || pending}
                  className="rounded-lg bg-[#5BAE5B] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#4e9d4e] disabled:opacity-40"
                >
                  Send to {recipients.valid.length}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
