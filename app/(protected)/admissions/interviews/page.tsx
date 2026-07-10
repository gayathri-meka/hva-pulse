import { getAppUser } from '@/lib/auth'
import { getInterviewOverview } from './actions'
import InterviewsAdmin from './InterviewsAdmin'

export const dynamic = 'force-dynamic'

export default async function InterviewsPage() {
  const user = await getAppUser()
  const { interviewers, slots, interviews } = await getInterviewOverview()
  return (
    <InterviewsAdmin
      interviewers={interviewers}
      slots={slots}
      interviews={interviews}
      isAdmin={user?.role === 'admin'}
    />
  )
}
