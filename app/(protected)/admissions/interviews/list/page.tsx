import { requireStaff } from '@/lib/auth'
import { getInterviewOverview } from '../actions'
import InterviewsListTable from './InterviewsListTable'

export const dynamic = 'force-dynamic'

export default async function InterviewsListPage() {
  await requireStaff()
  const { interviews } = await getInterviewOverview()
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">Interviews</h1>
      <p className="mt-1 text-sm text-zinc-500">Every booked interview. Filter by interviewer, date, round or status; open one to conduct it or read the notes.</p>
      <InterviewsListTable interviews={interviews} />
    </div>
  )
}
