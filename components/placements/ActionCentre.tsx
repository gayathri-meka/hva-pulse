import Link from 'next/link'

interface Props {
  awaitingShortlist: number
  inProcess: number
  totalApps: number
}

function pct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

function ActionItem({
  count,
  pctStr,
  title,
  description,
  href,
  countColor,
  borderColor,
  bgColor,
  dotColor,
}: {
  count: number
  pctStr: string
  title: string
  description: string
  href: string
  countColor: string
  borderColor: string
  bgColor: string
  dotColor: string
}) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-4 rounded-xl border ${borderColor} ${bgColor} p-4 transition-opacity hover:opacity-75`}
    >
      <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={`text-3xl font-bold tabular-nums ${countColor}`}>{count}</p>
          <p className="text-sm font-semibold text-zinc-800">{title}</p>
        </div>
        <p className={`mt-1 text-sm font-semibold ${countColor}`}>{pctStr} of total applications</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>
      </div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="mt-1 h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
      </svg>
    </Link>
  )
}

export default function ActionCentre({ awaitingShortlist, inProcess, totalApps }: Props) {
  const total = awaitingShortlist + inProcess

  return (
    <div>
      <div className="mb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-zinc-900">Action Centre</h2>
          {total > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-600">
              {total} pending
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-zinc-500">Items that need your attention</p>
      </div>

      <div className="space-y-3">
        <ActionItem
          count={awaitingShortlist}
          pctStr={pct(awaitingShortlist, totalApps)}
          title="applications need shortlisting"
          description="Candidates have applied but haven't been shortlisted or rejected yet. Review and update their status."
          href="/placements/applications?status=applied"
          countColor="text-blue-700"
          borderColor="border-blue-100"
          bgColor="bg-blue-50"
          dotColor="bg-blue-400"
        />
        <ActionItem
          count={inProcess}
          pctStr={pct(inProcess, totalApps)}
          title="interviews need an update"
          description="Shortlisted candidates are awaiting an interview outcome. Chase the company for a decision."
          href="/placements/applications?status=in_process"
          countColor="text-amber-700"
          borderColor="border-amber-100"
          bgColor="bg-amber-50"
          dotColor="bg-amber-400"
        />
      </div>
    </div>
  )
}
