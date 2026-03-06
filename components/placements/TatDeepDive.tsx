interface StageResult {
  avg: number | null
  n:   number
}

interface Props {
  total:      StageResult
  stage1:     StageResult
  stage2:     StageResult
  stage3:     StageResult
  cutoffDate: string // display string, e.g. "5 Mar 2026"
  isDummy?:   boolean
}

function fmt(days: number | null): string {
  if (days == null) return '—'
  return `${days}d`
}

function StageRow({
  color,
  label,
  result,
  pct,
}: {
  color: string
  label: string
  result: StageResult
  pct: number | null
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
      <p className="min-w-0 flex-1 text-sm text-zinc-600">{label}</p>
      <div className="flex items-center gap-2 tabular-nums">
        <span className="w-8 text-right text-sm font-semibold text-zinc-800">
          {fmt(result.avg)}
        </span>
        <span className="w-10 text-right text-xs font-medium text-zinc-400">
          {pct != null ? `${pct}%` : '—'}
        </span>
        <span className="w-12 text-right text-[10px] text-zinc-300">
          n={result.n}
        </span>
      </div>
    </div>
  )
}

export default function TatDeepDive({ total, stage1, stage2, stage3, cutoffDate, isDummy }: Props) {
  const stageSum = (stage1.avg ?? 0) + (stage2.avg ?? 0) + (stage3.avg ?? 0)

  const pct1 = stageSum > 0 && stage1.avg != null ? Math.round((stage1.avg / stageSum) * 100) : null
  const pct2 = stageSum > 0 && stage2.avg != null ? Math.round((stage2.avg / stageSum) * 100) : null
  const pct3 = stageSum > 0 && stage3.avg != null ? Math.round((stage3.avg / stageSum) * 100) : null

  const noData = stage1.n === 0 && stage2.n === 0 && stage3.n === 0

  return (
    <div className="mt-6 border-t border-zinc-100 pt-6">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-zinc-900">TAT Deep Dive</h3>
          {isDummy && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
              Dummy data
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-400">
          Applications from {cutoffDate} onwards
        </p>
      </div>

      {/* Total avg */}
      <div className="mb-4 flex items-baseline gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
        <p className="text-3xl font-bold tabular-nums text-zinc-800">
          {total.avg != null ? `${total.avg}d` : '—'}
        </p>
        <div>
          <p className="text-sm font-semibold text-zinc-700">avg time to hire</p>
          {total.n > 0 && (
            <p className="text-[11px] text-zinc-400">across {total.n} completed application{total.n !== 1 ? 's' : ''}</p>
          )}
        </div>
      </div>

      {noData ? (
        <p className="text-center text-xs text-zinc-400 py-4">
          No data yet — statuses will be tracked from {cutoffDate}.
        </p>
      ) : (
        <>
          {/* Stacked proportion bar */}
          {stageSum > 0 && (
            <div className="mb-4 flex h-2 w-full overflow-hidden rounded-full bg-zinc-100">
              {stage1.avg != null && pct1 != null && (
                <div className="bg-blue-400 transition-all" style={{ width: `${pct1}%` }} />
              )}
              {stage2.avg != null && pct2 != null && (
                <div className="bg-amber-400 transition-all" style={{ width: `${pct2}%` }} />
              )}
              {stage3.avg != null && pct3 != null && (
                <div className="bg-violet-400 transition-all" style={{ width: `${pct3}%` }} />
              )}
            </div>
          )}

          {/* Stage rows */}
          <div className="space-y-3">
            <StageRow
              color="bg-blue-400"
              label="Application → Screening"
              result={stage1}
              pct={pct1}
            />
            <StageRow
              color="bg-amber-400"
              label="Screening → Interviews"
              result={stage2}
              pct={pct2}
            />
            <StageRow
              color="bg-violet-400"
              label="Interviews → Final Decision"
              result={stage3}
              pct={pct3}
            />
          </div>
        </>
      )}
    </div>
  )
}
