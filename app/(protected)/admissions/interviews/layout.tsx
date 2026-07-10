import { getAppUser } from '@/lib/auth'
import InterviewsSubNav from '@/components/admissions/InterviewsSubNav'

export default async function InterviewsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAppUser()
  const isStaff = user?.role === 'admin' || user?.role === 'staff'
  // Interviewers see only the calendar (no sub-nav); admin/staff get both tabs.
  return (
    <div>
      {isStaff && <InterviewsSubNav />}
      {children}
    </div>
  )
}
