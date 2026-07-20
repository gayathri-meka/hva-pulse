import { requireInterviewer } from '@/lib/auth'
import { roundLabel } from '@/lib/interviews'
import { getMyCalendar } from '../actions'
import AvailabilityCalendar from './AvailabilityCalendar'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const user = await requireInterviewer()
  const { slots, interviews, round } = await getMyCalendar()
  // Staff/admin manage outcomes from the Interviews tab; a dedicated interviewer
  // (no access to that tab) keeps the bookings list here with its Done/No-show.
  const isDedicated = user.role === 'interviewer'
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-bold tracking-tight text-zinc-900">My interview calendar</h1>
        {round && (
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${round === 2 ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>
            {roundLabel(round, true)} panel
          </span>
        )}
        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">All times in IST (India)</span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Drag to mark when you&apos;re free. Each 1-hour slot becomes bookable by candidates
        {round ? <> for the <strong>{roundLabel(round, true)}</strong> round</> : null}. Booked interviews show in blue. Times are shown in IST regardless of your device timezone.
      </p>
      {isDedicated && round == null && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Your interview panel isn&apos;t set yet — ask an admin to assign you to the Motivation or Coding panel before publishing availability.</p>
      )}
      <AvailabilityCalendar slots={slots} interviews={interviews} showBookings={isDedicated} />
    </div>
  )
}
