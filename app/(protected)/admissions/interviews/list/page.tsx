import { requireStaff } from '@/lib/auth'
import { getInterviewOverview } from '../actions'
import { getInterviewScores } from '../cockpit-actions'
import { getInterviewReview } from '../review-actions'
import InterviewsListTable from './InterviewsListTable'

export const dynamic = 'force-dynamic'

export default async function InterviewsListPage() {
  await requireStaff()
  const [{ interviews }, scores, candidates] = await Promise.all([
    getInterviewOverview(),
    getInterviewScores(),
    getInterviewReview(),
  ])
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">Interviews</h1>
      <p className="mt-1 text-sm text-zinc-500">All interview candidates, including learners who have not scheduled yet. Click a scheduled interview to open its detailed notes.</p>
      <InterviewsListTable interviews={interviews} rubrics={scores.rubrics} scoreRows={scores.rows} candidates={candidates} />
    </div>
  )
}
