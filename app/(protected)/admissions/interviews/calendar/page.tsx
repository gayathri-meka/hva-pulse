import { requireInterviewer } from '@/lib/auth'
import { getMyCalendar } from '../actions'
import AvailabilityCalendar from './AvailabilityCalendar'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  await requireInterviewer()
  const { slots, interviews } = await getMyCalendar()
  return (
    <div>
      <h1 className="text-lg font-bold tracking-tight text-zinc-900">My interview calendar</h1>
      <p className="mt-1 text-sm text-zinc-500">Drag to mark when you&apos;re free. Each 1-hour slot becomes bookable by candidates. Booked interviews show in blue.</p>
      <AvailabilityCalendar slots={slots} interviews={interviews} />
    </div>
  )
}
