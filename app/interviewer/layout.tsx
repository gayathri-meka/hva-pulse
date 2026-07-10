import { requireInterviewer } from '@/lib/auth'
import InterviewerHeader from '@/components/interviewer/InterviewerHeader'

export const dynamic = 'force-dynamic'

export default async function InterviewerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInterviewer()
  const isStaff = user.role === 'admin' || user.role === 'staff'
  return (
    <div className="min-h-screen bg-zinc-50">
      <InterviewerHeader name={user.name ?? user.email} isStaff={isStaff} />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  )
}
