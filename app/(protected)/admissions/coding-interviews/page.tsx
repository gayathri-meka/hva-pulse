import { requireStaff } from '@/lib/auth'
import { getCodingInterviews } from './actions'
import CodingInterviewsTable from './CodingInterviewsTable'

export const dynamic = 'force-dynamic'

export default async function CodingInterviewsPage() {
  await requireStaff()
  const rows = await getCodingInterviews()
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">Coding Interviews</h1>
      <p className="mt-1 text-sm text-zinc-500">Round 2 candidates, scheduling status, scores, and interview observations.</p>
      <div className="mt-4"><CodingInterviewsTable rows={rows} /></div>
    </div>
  )
}
