import { requireStaff } from '@/lib/auth'
import { searchInterviewNotes } from '../cockpit-actions'
import NotesSearch from './NotesSearch'

export const dynamic = 'force-dynamic'

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff()
  const q = (await searchParams).q ?? ''
  const initial = await searchInterviewNotes(q)
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">Interview notes</h1>
      <p className="mt-1 text-sm text-zinc-500">Search a candidate by name or email to read the notes and scores captured in their interviews.</p>
      <NotesSearch initial={initial} initialQuery={q} />
    </div>
  )
}
