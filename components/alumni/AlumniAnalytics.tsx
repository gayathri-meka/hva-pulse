'use client'

import { useState, useTransition } from 'react'
import { upsertCohortStat } from '@/app/(protected)/alumni/actions'

type FyRow = { placed_fy: string; count: number }

export type CohortRow = {
  cohort_fy:    string
  id:           string | null
  onboarded:    number | null
  dropouts:     number | null
  placed:       number
  autoComputed: boolean   // true = live from learners table; false = manual cohort_stats
}

export default function AlumniAnalytics({
  fyRows,
  cohortRows,
}: {
  fyRows:     FyRow[]
  cohortRows: CohortRow[]
}) {
  const [editRow, setEditRow]        = useState<CohortRow | null>(null)
  const [isPending, startTransition] = useTransition()

  const fyTotal = fyRows.reduce((s, r) => s + r.count, 0)

  function openEdit(row: CohortRow) { setEditRow(row) }
  function openAdd()                { setEditRow({ cohort_fy: '', id: null, onboarded: null, dropouts: null, placed: 0, autoComputed: false }) }
  function closeModal()             { setEditRow(null) }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editRow) return
    const fd        = new FormData(e.currentTarget)
    const cohort_fy = (fd.get('cohort_fy') as string).trim()
    const onboarded = parseInt(fd.get('onboarded') as string, 10)
    const dropouts  = parseInt(fd.get('dropouts')  as string, 10)
    if (!cohort_fy || isNaN(onboarded) || isNaN(dropouts)) return
    startTransition(async () => {
      await upsertCohortStat(cohort_fy, onboarded, dropouts)
      closeModal()
    })
  }

  return (
    <>
      <div className="flex flex-wrap items-start gap-8">

        {/* ── By FY ── */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">By FY Placed</p>
          <div className="w-64 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left   text-xs font-medium uppercase tracking-wide text-zinc-500">FY</th>
                  <th className="px-4 py-3 text-right  text-xs font-medium uppercase tracking-wide text-zinc-500">Placed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {fyRows.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-zinc-400">No data yet</td>
                  </tr>
                )}
                {fyRows.map((r) => (
                  <tr key={r.placed_fy} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium text-zinc-900">{r.placed_fy}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-700">{r.count}</td>
                  </tr>
                ))}
              </tbody>
              {fyRows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50">
                    <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{fyTotal}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* ── By Cohort ── */}
        <div className="flex-1 min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">By Cohort</p>
            <button
              onClick={openAdd}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
            >
              + Add cohort
            </button>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50">
                  <th className="px-4 py-3 text-left  text-xs font-medium uppercase tracking-wide text-zinc-500">Cohort FY</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Onboarded</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Dropouts</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Placed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Yet to be placed</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">Placement %</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cohortRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                      No cohort data yet — click &ldquo;+ Add cohort&rdquo; to get started.
                    </td>
                  </tr>
                )}
                {cohortRows.map((row) => {
                  const active = row.onboarded !== null && row.dropouts !== null
                    ? row.onboarded - row.dropouts
                    : null
                  const rate = row.onboarded !== null && row.onboarded > 0
                    ? Math.round((row.placed / row.onboarded) * 100)
                    : null
                  return (
                    <tr key={row.cohort_fy} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-900">{row.cohort_fy}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-700">
                        {row.onboarded !== null ? row.onboarded : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-700">
                        {row.dropouts !== null ? row.dropouts : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-700">{row.placed}</td>
                      <td className="px-4 py-2.5 text-right text-zinc-700">
                        {active !== null ? active - row.placed : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-700">
                        {rate !== null ? `${rate}%` : <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {row.autoComputed ? (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600" title="Auto-computed from learners table">live</span>
                        ) : (
                          <button onClick={() => openEdit(row)} className="text-zinc-400 hover:text-zinc-600" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                              <path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L6.75 6.774a2.75 2.75 0 0 0-.596.892l-.848 2.047a.75.75 0 0 0 .98.98l2.047-.848a2.75 2.75 0 0 0 .892-.596l4.261-4.263a1.75 1.75 0 0 0 0-2.474Z" />
                              <path d="M4.75 3.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h6.5c.69 0 1.25-.56 1.25-1.25V9a.75.75 0 0 1 1.5 0v2.25A2.75 2.75 0 0 1 11.25 14h-6.5A2.75 2.75 0 0 1 2 11.25v-6.5A2.75 2.75 0 0 1 4.75 2H7a.75.75 0 0 1 0 1.5H4.75Z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {cohortRows.length > 0 && (() => {
                const totalOnboarded = cohortRows.every(r => r.onboarded !== null)
                  ? cohortRows.reduce((s, r) => s + (r.onboarded ?? 0), 0) : null
                const totalDropouts = cohortRows.every(r => r.dropouts !== null)
                  ? cohortRows.reduce((s, r) => s + (r.dropouts ?? 0), 0) : null
                const totalPlaced = cohortRows.reduce((s, r) => s + r.placed, 0)
                const totalActive = totalOnboarded !== null && totalDropouts !== null
                  ? totalOnboarded - totalDropouts : null
                const totalRate = totalOnboarded !== null && totalOnboarded > 0
                  ? Math.round((totalPlaced / totalOnboarded) * 100) : null
                return (
                  <tfoot>
                    <tr className="border-t border-zinc-200 bg-zinc-50">
                      <td className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{totalOnboarded ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{totalDropouts ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{totalPlaced}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{totalActive !== null ? totalActive - totalPlaced : <span className="text-zinc-300">—</span>}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-zinc-900">{totalRate !== null ? `${totalRate}%` : <span className="text-zinc-300">—</span>}</td>
                      <td />
                    </tr>
                  </tfoot>
                )
              })()}
            </table>
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Onboarded &amp; Dropouts are manually entered. Placed is live from the alumni table.
          </p>
        </div>
      </div>

      {/* Add / Edit modal */}
      {editRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              {editRow.id ? 'Edit cohort stats' : 'Add cohort'}
            </h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600">Cohort FY</label>
                {editRow.id ? (
                  <>
                    <input type="hidden" name="cohort_fy" value={editRow.cohort_fy} />
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                      {editRow.cohort_fy}
                    </div>
                  </>
                ) : (
                  <input
                    name="cohort_fy"
                    defaultValue={editRow.cohort_fy}
                    placeholder="e.g. 2024-25"
                    required
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Onboarded</label>
                  <input
                    name="onboarded"
                    type="number"
                    min={0}
                    defaultValue={editRow.onboarded ?? ''}
                    required
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-600">Dropouts</label>
                  <input
                    name="dropouts"
                    type="number"
                    min={0}
                    defaultValue={editRow.dropouts ?? ''}
                    required
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
