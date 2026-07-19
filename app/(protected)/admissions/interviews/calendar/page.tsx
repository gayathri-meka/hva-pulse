import { requireInterviewer } from '@/lib/auth'
import { getMyCalendar } from '../actions'
import AvailabilityCalendar from './AvailabilityCalendar'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const user = await requireInterviewer()
  const { slots, interviews } = await getMyCalendar()
  // Staff/admin manage outcomes from the Interviews tab; a dedicated interviewer
  // (no access to that tab) keeps the bookings list here with its Done/No-show.
  const isDedicated = user.role === 'interviewer'
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight text-zinc-900">My interview calendar</h1>
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">All times in IST (India)</span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">Drag to mark when you&apos;re free. Each 1-hour slot becomes bookable by candidates. Booked interviews show in blue. Times are shown in IST regardless of your device timezone.</p>
      <AvailabilityCalendar slots={slots} interviews={interviews} showBookings={isDedicated} />
    </div>
  )
}
