import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSheetRows } from '@/lib/google'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Pulls both tabs of the HVA Meet Logs spreadsheet and upserts into Postgres.
// Manually triggered by the team via the "Sync now" button on the
// Settings -> Sheets page (or the Attendance page). Admin-only.

const SHEET_ID    = process.env.GOOGLE_ATTENDANCE_SHEET_ID
const CALLS_TAB   = 'Meet Codes'
const LOGS_TAB    = 'Attendance Logs'

export async function POST() {
  if (!SHEET_ID) {
    return NextResponse.json(
      { error: 'GOOGLE_ATTENDANCE_SHEET_ID is not configured' },
      { status: 500 },
    )
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email!)
    .single()
  if (!appUser || appUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Write via service-role so RLS doesn't get in the way of inserts/upserts.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  try {
    // ── 1. Meet Codes tab → calls ─────────────────────────────────────────────
    const callRows = await getSheetRows(SHEET_ID, CALLS_TAB)
    const calls = callRows
      .filter((r) => r.meet_code && r.call_name)
      .map((r) => ({
        meeting_code: r.meet_code.trim(),
        name:         r.call_name.trim(),
        type:         (r.call_type || '').trim(),
        batch:        (r.batch || '').trim() || null,
        updated_at:   new Date().toISOString(),
      }))

    if (calls.length > 0) {
      const { error: callsErr } = await admin
        .from('calls')
        .upsert(calls, { onConflict: 'meeting_code' })
      if (callsErr) throw new Error(`calls upsert failed: ${callsErr.message}`)
    }

    // ── 2. Attendance Logs tab → attendance_records ──────────────────────────
    // We only store present rows. Absences are inferred at query time from
    // (learners.batch_name) minus (rows in attendance_records).
    const logRows = await getSheetRows(SHEET_ID, LOGS_TAB)
    const rawRecords = logRows
      .filter((r) =>
        r.meeting_code &&
        r.participant_email &&
        r.date &&
        (r.status || '').toLowerCase().trim() === 'present'
      )
      .map((r) => ({
        meeting_code:      r.meeting_code.trim(),
        participant_email: r.participant_email.trim().toLowerCase(),
        participant_name:  r.name?.trim() || null,
        call_date:         normalizeDate(r.date),
        call_time:         normalizeTime(r.time),
        duration_minutes:  parseFloat(r.duration) || null,
        organizer_email:   r.organizer_email?.trim().toLowerCase() || null,
        synced_at:         new Date().toISOString(),
      }))

    // Same (meeting_code, email, date) can appear multiple times in the sheet
    // — e.g. a learner drops and rejoins the same session. Postgres upsert
    // can't handle the same conflict key twice in one batch, so collapse by
    // keeping the row with the longest duration (most engaged attempt).
    const dedupMap = new Map<string, (typeof rawRecords)[number]>()
    for (const r of rawRecords) {
      const key = `${r.meeting_code}::${r.participant_email}::${r.call_date}`
      const existing = dedupMap.get(key)
      if (!existing || (r.duration_minutes ?? 0) > (existing.duration_minutes ?? 0)) {
        dedupMap.set(key, r)
      }
    }
    const records = Array.from(dedupMap.values())

    if (records.length > 0) {
      const { error: attErr } = await admin
        .from('attendance_records')
        .upsert(records, { onConflict: 'meeting_code,participant_email,call_date' })
      if (attErr) throw new Error(`attendance upsert failed: ${attErr.message}`)
    }

    await admin.from('sync_logs').upsert(
      {
        sheet_key:       'attendance',
        last_synced_at:  new Date().toISOString(),
        records_synced:  records.length,
      },
      { onConflict: 'sheet_key' },
    )

    return NextResponse.json({
      success:    true,
      count:      records.length,    // attendance rows — what the sheets settings UI reads
      calls:      calls.length,
      attendance: records.length,
      synced_at:  new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    )
  }
}

// Sheet cells may be ISO-ish ("2026-04-23"), Google's serialized format, or
// human strings. We trust the FORMATTED_VALUE the helper returns ("2026-04-23"),
// just trim it.
function normalizeDate(s: string): string {
  return s.trim()
}

// "9:15 PM" → "21:15:00". Returns null if unparseable.
function normalizeTime(s: string | undefined): string | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const mm = parseInt(m[2], 10)
  const ampm = m[3]?.toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`
}
