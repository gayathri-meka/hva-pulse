import { NextResponse } from 'next/server'
import { getSheetRows } from '@/lib/google'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function parseNum(val: string): number | null {
  if (!val?.trim()) return null
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

function parseDate(val: string): string | null {
  if (!val?.trim()) return null
  // Explicit MM/DD/YYYY parse — avoids engine-dependent new Date() interpretation
  const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
  // Fallback: use local date methods to avoid UTC shift
  const d = new Date(val)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function POST() {
  try {
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

    const rows = await getSheetRows(process.env.GOOGLE_LEARNER_INFO_SHEET_ID!, 'Learner info')
    const validRows = rows.filter((row) => row['email']?.trim())

    // email → user_id
    const emails = validRows.map((r) => r['email'].trim().toLowerCase())
    const { data: matchedUsers } = await supabase
      .from('users')
      .select('id, email')
      .in('email', emails)

    const emailToUserId = new Map<string, string>()
    for (const u of matchedUsers ?? []) {
      if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id)
    }

    // user_id → learner_id
    const userIds = Array.from(emailToUserId.values())
    const { data: matchedLearners } = await supabase
      .from('learners')
      .select('learner_id, user_id')
      .in('user_id', userIds)

    const userIdToLearnerId = new Map<string, string>()
    for (const l of matchedLearners ?? []) {
      if (l.user_id) userIdToLearnerId.set(l.user_id, l.learner_id)
    }

    const updates = validRows
      .map((row) => {
        const email     = row['email'].trim().toLowerCase()
        const userId    = emailToUserId.get(email)
        if (!userId) return null
        const learnerId = userIdToLearnerId.get(userId)
        if (!learnerId) return null

        return {
          learner_id:         learnerId,
          user_id:            userId,
          year_of_graduation: row['year_of_graduation']?.trim() ? (parseInt(row['year_of_graduation'], 10) || null) : null,
          degree:             row['degree']?.trim()           || null,
          specialisation:     row['specialisation']?.trim() || row['specialization']?.trim() || null,
          current_location:   row['current_location']?.trim() || null,
          prs:                parseNum(row['prs']),
          readiness:          row['readiness']?.trim()        || null,
          blacklisted_date:   parseDate(row['blacklisted_date']),
          proactiveness:      parseNum(row['proactiveness']),
          articulation:       parseNum(row['articulation']),
          comprehension:      parseNum(row['comprehension']),
          tech_score:         parseNum(row['tech_score']),
        }
      })
      .filter(Boolean)

    if (updates.length > 0) {
      const { error } = await supabase
        .from('learners')
        .upsert(updates, { onConflict: 'learner_id' })
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    await supabase.from('sync_logs').upsert(
      { sheet_key: 'learner_info', last_synced_at: new Date().toISOString(), records_synced: updates.length },
      { onConflict: 'sheet_key' }
    )

    return NextResponse.json({ success: true, count: updates.length })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
