import type { ActionItem, ReviewEntry } from './InterventionPanel'

export type ClosedIntervention = {
  id:                  string
  status:              'closed'
  root_cause_category: string | null
  root_cause_notes:    string | null
  action_items:        ActionItem[]
  reviews:             ReviewEntry[]
  outcome:             'resolved' | 'dropped' | 'other' | null
  outcome_note:        string | null
  closed_at:           string | null
  closed_by_name:      string | null
  opened_at:           string | null
}

interface Props {
  history: ClosedIntervention[]
}

const OUTCOME_BADGE: Record<string, string> = {
  resolved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  dropped:  'bg-zinc-50 text-zinc-600 border border-zinc-200',
  other:    'bg-amber-50 text-amber-700 border border-amber-200',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function InterventionHistory({ history }: Props) {
  if (history.length === 0) return null

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Past interventions ({history.length})
      </p>
      <div className="space-y-3">
        {history.map((iv) => {
          const doneCount = (iv.action_items ?? []).filter((it) => !!it.completed_at).length
          const total     = (iv.action_items ?? []).length
          return (
            <div key={iv.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {iv.outcome && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${OUTCOME_BADGE[iv.outcome] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {iv.outcome}
                      </span>
                    )}
                    <span className="text-xs text-zinc-400">
                      Closed {fmtDate(iv.closed_at)}{iv.closed_by_name ? ` · ${iv.closed_by_name}` : ''}
                    </span>
                  </div>
                  {iv.root_cause_category && (
                    <p className="text-sm font-medium text-zinc-700">
                      Root cause: <span className="text-zinc-600 font-normal">{iv.root_cause_category}</span>
                    </p>
                  )}
                  {iv.root_cause_notes && (
                    <p className="text-xs text-zinc-500">{iv.root_cause_notes}</p>
                  )}
                  {iv.outcome_note && (
                    <p className="mt-1 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
                      <span className="text-zinc-400">Outcome note: </span>{iv.outcome_note}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-400">
                  {total > 0 && <div>{doneCount}/{total} actions done</div>}
                  {iv.reviews && iv.reviews.length > 0 && <div>{iv.reviews.length} review{iv.reviews.length !== 1 ? 's' : ''}</div>}
                </div>
              </div>

              {/* Action items */}
              {(iv.action_items ?? []).length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
                  {iv.action_items.map((item, i) => (
                    <li key={i} className="text-xs text-zinc-600">
                      <span className={item.completed_at ? 'text-zinc-400 line-through' : ''}>
                        {item.description}
                      </span>
                      {item.owner && <span className="text-zinc-400"> · {item.owner}</span>}
                      {item.completed_at && <span className="text-[#5BAE5B]"> · done {fmtDate(item.completed_at)}</span>}
                    </li>
                  ))}
                </ul>
              )}

              {/* Reviews */}
              {iv.reviews && iv.reviews.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
                  {iv.reviews.map((r, i) => (
                    <li key={i} className="text-xs text-zinc-600">
                      <span className="text-zinc-400">{fmtDate(r.at)}{r.by_name ? ` · ${r.by_name}` : ''}: </span>
                      {r.note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
