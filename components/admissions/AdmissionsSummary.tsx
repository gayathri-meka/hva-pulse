// Descriptive header strip shown at the top of every Admissions tab: a one-line
// explanation of what the tab represents plus the key counts. Server component.
export default function AdmissionsSummary({
  description,
  stats = [],
}: {
  description: string
  stats?: { label: string; value: string | number }[]
}) {
  return (
    <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3">
      <p className="text-sm text-zinc-600">{description}</p>
      {stats.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {stats.map((s, i) => (
            <span key={s.label} className="flex items-center gap-1.5">
              {i > 0 && <span className="text-zinc-300">·</span>}
              <span className="font-semibold text-zinc-900">{s.value}</span>
              <span className="text-zinc-500">{s.label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
