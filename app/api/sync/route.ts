import { NextResponse } from 'next/server'
import { getSheetRows } from '@/lib/google'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()

    // Admin-only
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

    const rows = await getSheetRows()

    // Build LF name → id lookup
    const { data: lfs } = await supabase.from('lfs').select('id, name')
    const lfMap = new Map<string, number>()
    for (const lf of lfs ?? []) {
      lfMap.set(lf.name.trim().toLowerCase(), lf.id)
    }

    const learners = rows
      .filter((row) => row['email'])
      .map((row) => {
        const lfNameRaw = row['lf']?.trim() ?? ''
        const lfId = lfNameRaw ? (lfMap.get(lfNameRaw.toLowerCase()) ?? null) : null
        return {
          learner_id: row['learner_id'] ?? '',
          name: row['name'] ?? '',
          email: row['email'],
          phone_number: row['phone_number'] ?? '',
          category: row['category'] ?? '',
          lf_name: lfNameRaw,
          lf_id: lfId,
          status: row['status'] ?? '',
          batch_name: row['batch_name'] ?? '',
          tech_mentor_name: row['tech_mentor'] ?? '',
          core_skills_mentor_name: row['core_skills_mentor'] ?? '',
          track: row['track'] ?? '',
          join_date: row['join_date'] || null,
        }
      })

    const { error } = await supabase
      .from('learners')
      .upsert(learners, { onConflict: 'email' })

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // Step 1: collect all emails from sheet
    const sheetEmails = new Set(learners.map((l) => l.email))

    // Step 2: fetch all existing learner emails from Supabase
    const { data: existing } = await supabase.from('learners').select('email')

    // Step 3: identify DB emails not in sheet (exclude nulls — handled separately)
    const toDelete = (existing ?? [])
      .map((r) => r.email)
      .filter((e): e is string => !!e && !sheetEmails.has(e))

    // Step 4: delete rows whose email is no longer in the sheet
    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('learners')
        .delete()
        .in('email', toDelete)

      if (deleteError) {
        return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
      }
    }

    // Also remove any rows with null or empty email (orphaned from old syncs)
    await supabase.from('learners').delete().is('email', null)
    await supabase.from('learners').delete().eq('email', '')

    return NextResponse.json({ success: true, count: learners.length, deleted: toDelete.length })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
