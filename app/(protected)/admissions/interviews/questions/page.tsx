import { requireStaff } from '@/lib/auth'
import { getInterviewContent } from '../cockpit-actions'
import QuestionsEditor from './QuestionsEditor'

export const dynamic = 'force-dynamic'

export default async function QuestionsPage() {
  await requireStaff()
  const { questions, rubrics } = await getInterviewContent()
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">Questions &amp; rubrics</h1>
      <p className="mt-1 text-sm text-zinc-500">
        The question bank and scoring rubrics every interviewer sees in the cockpit. Questions can be shared across both rounds or scoped to one.
      </p>
      <QuestionsEditor questions={questions} rubrics={rubrics} />
    </div>
  )
}
