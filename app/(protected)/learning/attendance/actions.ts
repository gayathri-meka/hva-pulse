'use server'

import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export type AttendeeDetail = {
  email:            string
  name:             string | null
  duration_minutes: number | null
}

/**
 * Returns the attendee list (with name + duration) for a single session.
 * Called when the user clicks the ✓ pill on a card, so we don't ship
 * 5k+ duration/name fields up front. Admin/staff only.
 */
export async function getAttendees(
  meetingCode: string,
  callDate:    string,
): Promise<AttendeeDetail[]> {
  const user = await getAppUser()
  if (!user || (user.role !== 'admin' && user.role !== 'staff')) return []

  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase
    .from('attendance_records')
    .select('participant_email, participant_name, duration_minutes')
    .eq('meeting_code', meetingCode)
    .eq('call_date',    callDate)

  if (error) throw new Error(error.message)

  return (data ?? []).map((r) => ({
    email:            r.participant_email,
    name:             r.participant_name,
    duration_minutes: r.duration_minutes,
  }))
}
