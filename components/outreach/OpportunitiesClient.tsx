'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { JobOpportunityWithPersona, JobPersona } from '@/types'
import OpportunityDrawer from './OpportunityDrawer'

const STATUS_BADGE: Record<string, string> = {
  discovered: 'bg-zinc-100 text-zinc-600',
  reviewed: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
}

const STATUS_LABELS: Record<string, string> = {
  discovered: 'Discovered',
  reviewed: 'Reviewed',
  approved: 'Approved',
  rejected: 'Rejected',
}

type ActiveFilters = {
  persona?: string
  source?: string
  status?: string
  from?: string
  to?: string
  id?: string
}

type Props = {
  opportunities: JobOpportunityWithPersona[]
  personas: Pick<JobPersona, 'id' | 'name'>[]
  activeFilters: ActiveFilters
  selectedId?: string
}

export default function OpportunitiesClient({ opportunities, personas, activeFilters, selectedId }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedOpportunity = selectedId
    ? opportunities.find((o) => o.id === selectedId) ?? null
    : null

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('id')
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  function openDrawer(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('id', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  function clearFilters() {
    router.push(pathname)
  }

  const hasFilters = activeFilters.persona || activeFilters.source || activeFilters.status || activeFilters.from || activeFilters.to

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={activeFilters.persona ?? ''}
          onChange={(e) => updateFilter('persona', e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500"
        >
          <option value="">All Personas</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <select
          value={activeFilters.status ?? ''}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500"
        >
          <option value="">All Statuses</option>
          {(['discovered', 'reviewed', 'approved', 'rejected'] as const).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <select
          value={activeFilters.source ?? ''}
          onChange={(e) => updateFilter('source', e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500"
        >
          <option value="">All Sources</option>
          <option value="jooble">Jooble</option>
          <option value="manual">Manual</option>
        </select>

        <div className="flex items-center gap-1.5 text-sm text-zinc-500">
          <span>From</span>
          <input
            type="date"
            value={activeFilters.from ?? ''}
            onChange={(e) => updateFilter('from', e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500"
          />
          <span>to</span>
          <input
            type="date"
            value={activeFilters.to ?? ''}
            onChange={(e) => updateFilter('to', e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-zinc-500"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-zinc-400 underline-offset-2 hover:text-zinc-600 hover:underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-sm text-zinc-400">
          {opportunities.length} result{opportunities.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      {opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-200 py-16 text-center">
          <p className="text-sm font-medium text-zinc-500">No opportunities found</p>
          <p className="mt-1 text-xs text-zinc-400">
            {hasFilters ? 'Try adjusting your filters' : 'Run a scrape from the Job Personas tab to discover opportunities'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Job Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Company</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 md:table-cell">Location</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 lg:table-cell">Source</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 lg:table-cell">Posted</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 xl:table-cell">Persona</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {opportunities.map((opp) => (
                <tr
                  key={opp.id}
                  onClick={() => openDrawer(opp.id)}
                  className={`cursor-pointer transition-colors hover:bg-zinc-50 ${
                    selectedId === opp.id ? 'bg-zinc-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 max-w-[200px] truncate">{opp.job_title}</td>
                  <td className="px-4 py-3 text-zinc-600 max-w-[160px] truncate">{opp.company_name}</td>
                  <td className="hidden px-4 py-3 text-zinc-500 md:table-cell">{opp.location ?? '—'}</td>
                  <td className="hidden px-4 py-3 text-zinc-500 capitalize lg:table-cell">{opp.source_platform}</td>
                  <td className="hidden px-4 py-3 text-zinc-500 lg:table-cell">
                    {opp.date_posted
                      ? new Date(opp.date_posted).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                      : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-500 xl:table-cell max-w-[140px] truncate">
                    {opp.persona_name ?? <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[opp.status]}`}>
                      {STATUS_LABELS[opp.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {selectedOpportunity && (
        <OpportunityDrawer opportunity={selectedOpportunity} />
      )}
    </div>
  )
}
