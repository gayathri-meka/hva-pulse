import type { Intervention, UpdateLogEntry, CaseTrigger } from './CasePanel'
import { MetricChartLoader } from './MetricTriggerPicker'

export type ClosedCase = {
  id:                    string
  status:                'closed'
  severity:              'Low' | 'Medium' | 'High' | null
  accountable_team:      'Program' | 'Learning' | null
  flagged_items:         string[]
  what_wrong_notes:      string | null
  root_cause_type:       'time' | 'learning' | 'both' | 'other' | null
  root_cause_categories: string[]
  root_cause_notes:      string | null
  interventions:         Intervention[]
  update_log:            UpdateLogEntry[]
  outcome:               'resolved' | 'dropped' | 'other' | null
  outcome_note:          string | null
  decision_date:         string | null
  closed_at:             string | null
  closed_by_name:        string | null
  opened_at:             string | null
  triggers:              CaseTrigger[]
  // Only populated on the cohort-wide Closed cases tab so each card can
  // identify and link to the learner.
  learner_id?:           string | null
  learner_name?:         string | null
}

interface Props {
  history: ClosedCase[]
  /** Override the "Past cases (N)" heading. Pass `null` to hide it entirely
      (used on the cohort-wide Closed cases tab where there's a tab title). */
  heading?: string | null
  /** When true, each card surfaces the learner name (if present) as a link to
      the learner-wise case view. Used on the cohort-wide tab. */
  showLearner?: boolean
  /** Required for rendering metric trigger charts when the per-learner
      caller doesn't already encode learner_id on each ClosedCase row. */
  fallbackLearnerId?: string
}

const OUTCOME_BADGE: Record<string, string> = {
  resolved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  dropped:  'bg-zinc-50 text-zinc-600 border border-zinc-200',
  other:    'bg-amber-50 text-amber-700 border border-amber-200',
}

const SEVERITY_BADGE: Record<string, string> = {
  Low:    'bg-zinc-100 text-zinc-600',
  Medium: 'bg-amber-100 text-amber-700',
  High:   'bg-red-100 text-red-700',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function CaseHistory({ history, heading, showLearner = false, fallbackLearnerId }: Props) {
  if (history.length === 0) return null

  const headerText = heading === null
    ? null
    : heading ?? `Past cases (${history.length})`

  return (
    <div>
      {headerText && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {headerText}
        </p>
      )}
      <div className="space-y-3">
        {history.map((iv) => {
          const doneCount = (iv.interventions ?? []).filter((it) => !!it.completed_at).length
          const total     = (iv.interventions ?? []).length
          return (
            <div key={iv.id} className="rounded-xl border border-zinc-200 bg-white p-4">
              {/* Header: outcome + meta badges */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                  {showLearner && iv.learner_name && (
                    <p className="text-sm font-semibold text-zinc-900">
                      {iv.learner_id ? (
                        <a
                          href={`/learning?filter=cases&view=learner&learner=${iv.learner_id}`}
                          className="hover:underline"
                        >
                          {iv.learner_name}
                        </a>
                      ) : iv.learner_name}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {iv.outcome && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${OUTCOME_BADGE[iv.outcome] ?? 'bg-zinc-100 text-zinc-600'}`}>
                        {iv.outcome}
                      </span>
                    )}
                    {iv.severity && (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[iv.severity]}`}>
                        Severity: {iv.severity}
                      </span>
                    )}
                    {iv.accountable_team && (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        {iv.accountable_team} team
                      </span>
                    )}
                  </div>

                  {/* Timeline strip */}
                  <p className="text-xs text-zinc-400">
                    <span className="text-zinc-500">Opened</span> {fmtDate(iv.opened_at)}
                    {iv.decision_date && (
                      <> · <span className="text-zinc-500">Decision</span> {fmtDate(iv.decision_date)}</>
                    )}
                    {iv.closed_at && (
                      <> · <span className="text-zinc-500">Closed</span> {fmtDate(iv.closed_at)}{iv.closed_by_name ? ` by ${iv.closed_by_name}` : ''}</>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-zinc-400">
                  {total > 0 && <div>{doneCount}/{total} interventions done</div>}
                  {iv.update_log && iv.update_log.length > 0 && <div>{iv.update_log.length} update{iv.update_log.length !== 1 ? 's' : ''}</div>}
                </div>
              </div>

              {/* Triggers */}
              {iv.triggers.length > 0 && (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Triggers</p>
                  <ul className="space-y-2">
                    {iv.triggers.map((t) => {
                      const learnerForChart = iv.learner_id ?? fallbackLearnerId
                      return (
                        <li key={t.id} className="text-xs text-zinc-600">
                          {t.kind === 'observation' ? (
                            <>
                              <span className="text-zinc-400">Obs · {t.observation ? fmtDate(t.observation.observed_at) : '—'}</span>
                              {' · '}
                              <span>{t.observation?.note ?? <span className="text-zinc-400">(observation deleted)</span>}</span>
                            </>
                          ) : (
                            <>
                              <div>
                                <span className="text-zinc-400">Metric</span>
                                {' · '}
                                <span>{t.metric?.name ?? <span className="text-zinc-400">(metric deleted)</span>}</span>
                                {t.metric_period_label && <span className="text-zinc-400"> · {t.metric_period_label}</span>}
                                {t.metric_value !== null && <span className="text-zinc-500"> = {t.metric_value}</span>}
                              </div>
                              {t.metric && learnerForChart && (
                                <div className="mt-1 rounded-md border border-zinc-100 bg-zinc-50 p-2">
                                  <MetricChartLoader learnerId={learnerForChart} metricId={t.metric.id} />
                                </div>
                              )}
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              {/* What's wrong */}
              {(iv.flagged_items.length > 0 || iv.what_wrong_notes) && (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">What was wrong</p>
                  {iv.flagged_items.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {iv.flagged_items.map((f) => (
                        <span key={f} className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  {iv.what_wrong_notes && (
                    <p className="text-xs text-zinc-600">{iv.what_wrong_notes}</p>
                  )}
                </div>
              )}

              {/* Why */}
              {(iv.root_cause_categories.length > 0 || iv.root_cause_notes || iv.root_cause_type) && (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Why{iv.root_cause_type ? ` · ${iv.root_cause_type}` : ''}
                  </p>
                  {iv.root_cause_categories.length > 0 && (
                    <div className="mb-1 flex flex-wrap gap-1">
                      {iv.root_cause_categories.map((c) => (
                        <span key={c} className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {iv.root_cause_notes && (
                    <p className="text-xs text-zinc-600">{iv.root_cause_notes}</p>
                  )}
                </div>
              )}

              {/* Outcome note */}
              {iv.outcome_note && (
                <div className="mt-3 border-t border-zinc-100 pt-3">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Outcome note</p>
                  <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600">{iv.outcome_note}</p>
                </div>
              )}

              {/* Action items */}
              {(iv.interventions ?? []).length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
                  {iv.interventions.map((item, i) => (
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

              {/* Update log */}
              {iv.update_log && iv.update_log.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
                  {iv.update_log.map((r, i) => (
                    <li key={i} className="text-xs">
                      <span className="text-zinc-400">{fmtDate(r.at)}{r.by_name ? ` · ${r.by_name}` : ''}</span>
                      <p className="mt-0.5 text-zinc-600">{r.note}</p>
                      {r.decision_date_pushed_to && (
                        <p className="mt-0.5 text-zinc-400">Decision date pushed to {fmtDate(r.decision_date_pushed_to)}</p>
                      )}
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
