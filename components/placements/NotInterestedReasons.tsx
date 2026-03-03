interface Props {
  reasonCounts: Record<string, number>
  title:    string
  subtitle: string
}

const COLORS: { bar: string; text: string }[] = [
  { bar: 'bg-indigo-400',  text: 'text-indigo-500'  },
  { bar: 'bg-violet-400',  text: 'text-violet-500'  },
  { bar: 'bg-blue-400',    text: 'text-blue-500'    },
  { bar: 'bg-fuchsia-400', text: 'text-fuchsia-500' },
  { bar: 'bg-cyan-500',    text: 'text-cyan-600'    },
  { bar: 'bg-purple-400',  text: 'text-purple-500'  },
  { bar: 'bg-sky-400',     text: 'text-sky-500'     },
]

export default function NotInterestedReasons({ reasonCounts, title, subtitle }: Props) {
  const entries = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] ?? 1

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-zinc-900">{title}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-zinc-400">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([reason, count], i) => {
            const color = COLORS[i % COLORS.length]
            return (
              <div key={reason}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-zinc-700">{reason}</span>
                  <span className={`shrink-0 text-xs font-bold tabular-nums ${color.text}`}>{count}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className={`h-full rounded-full ${color.bar}`}
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
