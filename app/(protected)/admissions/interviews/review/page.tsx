import { requireStaff } from '@/lib/auth'
import { getInterviewReview } from '../review-actions'
import ReviewTable from './ReviewTable'

export const dynamic = 'force-dynamic'

export default async function InterviewReviewPage() {
  await requireStaff()
  const rows = await getInterviewReview()
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">Review</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Challenge-selected candidates and where they are in the interview pipeline. Release <strong>advance</strong> after
        Round 1 to open the Coding round; make the final <strong>select</strong> after Round 2. Rejections stay internal
        until released.
      </p>
      <ReviewTable rows={rows} />
    </div>
  )
}
