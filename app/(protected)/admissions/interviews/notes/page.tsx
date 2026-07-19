import { requireStaff } from '@/lib/auth'
import { getInterviewScores } from '../cockpit-actions'
import NotesTable from './NotesTable'

export const dynamic = 'force-dynamic'

export default async function NotesPage() {
  await requireStaff()
  const { rubrics, rows } = await getInterviewScores()
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">Interview notes &amp; scores</h1>
      <p className="mt-1 text-sm text-zinc-500">Every interview with its rubric scores and decision. Open one to read or take notes.</p>
      <NotesTable rubrics={rubrics} rows={rows} />
    </div>
  )
}
