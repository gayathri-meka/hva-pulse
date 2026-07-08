import { requireStaff } from '@/lib/auth'
import ScorecardStudio from './ScorecardStudio'

export const dynamic = 'force-dynamic'

export default async function ToolsPage() {
  await requireStaff() // staff + admin only; learners are redirected by the layout

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-widest text-[#5BAE5B]">Team tooling</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900">Scorecard Studio</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Build, check, and dry-run SensAI grading scorecards so the AI grades learner answers consistently.
        </p>
      </div>
      <ScorecardStudio />
    </div>
  )
}
