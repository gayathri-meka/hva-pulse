'use client'

type FyRow = { placed_fy: string; count: number }

export default function AlumniAnalytics({ fyRows }: { fyRows: FyRow[] }) {
  const total = fyRows.reduce((s, r) => s + r.count, 0)

  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">FY Year</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Learners Placed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {fyRows.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-8 text-center text-zinc-400">No placement data yet</td>
            </tr>
          )}
          {fyRows.map((r) => (
            <tr key={r.placed_fy} className="hover:bg-zinc-50">
              <td className="px-4 py-3 font-medium text-zinc-900">{r.placed_fy}</td>
              <td className="px-4 py-3 text-right text-zinc-700">{r.count}</td>
            </tr>
          ))}
        </tbody>
        {fyRows.length > 0 && (
          <tfoot>
            <tr className="border-t border-zinc-200 bg-zinc-50">
              <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</td>
              <td className="px-4 py-3 text-right font-semibold text-zinc-900">{total}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
