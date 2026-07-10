import { requireInterviewer } from '@/lib/auth'
import InterviewerHeader from '@/components/interviewer/InterviewerHeader'

export const dynamic = 'force-dynamic'

export default async function InterviewerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInterviewer()
  return (
    <div className="min-h-screen bg-zinc-50">
      <InterviewerHeader name={user.name ?? user.email} />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
