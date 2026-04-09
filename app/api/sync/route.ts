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

    const rows = await getSheetRows(process.env.GOOGLE_LEARNER_ROSTER_SHEET_ID!, 'Learners')
    const validRows = rows.filter((row) => row['email'] && row['learner_id'])

    // ── Step 1: Upsert a users row for every learner ──────────────────────────
    const learnerUsers = validRows.map((row) => ({
      email: row['email'],
      name: row['name'] ?? '',
      role: 'learner',
    }))

    const { error: usersError } = await supabase
      .from('users')
      .upsert(learnerUsers, { onConflict: 'email', ignoreDuplicates: false })

    if (usersError) {
      return NextResponse.json({ success: false, error: usersError.message }, { status: 500 })
    }

    // ── Step 2: Build LF name → user_id map (LFs already in users as role='LF') ─
    const { data: lfUsers } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'LF')

    const lfNameToUserId = new Map<string, string>()
    for (const lf of lfUsers ?? []) {
      if (lf.name) lfNameToUserId.set(lf.name.trim().toLowerCase(), lf.id)
    }

    // ── Step 3: Build learner email → user_id map ─────────────────────────────
    const allEmails = validRows.map((r) => r['email'])
    const { data: learnerUserRows } = await supabase
      .from('users')
      .select('id, email')
      .in('email', allEmails)

    const emailToUserId = new Map<string, string>()
    for (const u of learnerUserRows ?? []) {
      emailToUserId.set(u.email, u.id)
    }

    // ── Step 4: Build learner domain rows (no name/email/lf_id) ──────────────
    const learners = validRows.map((row) => {
      const lfNameRaw = row['lf']?.trim() ?? ''
      const lfUserId = lfNameRaw ? (lfNameToUserId.get(lfNameRaw.toLowerCase()) ?? null) : null
      const userId = emailToUserId.get(row['email']) ?? null

      return {
        learner_id: row['learner_id'],
        user_id: userId,
        lf_user_id: lfUserId,
        phone_number: row['phone_number'] ?? '',
        category: row['category'] ?? '',
        lf_name: lfNameRaw,
        status: row['status'] ?? '',
        batch_name: row['batch_name'] ?? '',
        tech_mentor_name: row['tech_mentor'] ?? '',
        core_skills_mentor_name: row['core_skills_mentor'] ?? '',
        track: row['track'] ?? '',
        join_date: row['join_date'] || null,
        cohort_fy:         row['cohort_fy'] || '2025-26',
        placed_fy:         row['placed_fy'] || null,
        is_current_cohort: true,
        sub_cohort:        row['sub_cohort'] || null,
        new_lf:            row['new_lf']?.trim()     || null,
        new_batch:         row['new_batch']?.trim()  || null,
        new_mentor:        row['new_mentor']?.trim() || null,
      }
    }).filter((l) => l.user_id !== null)

    const { error: learnersError } = await supabase
      .from('learners')
      .upsert(learners, { onConflict: 'learner_id' })

    if (learnersError) {
      return NextResponse.json({ success: false, error: learnersError.message }, { status: 500 })
    }

    // ── Step 6: Auto-create alumni rows for placed learners ───────────────────
    const placedStatuses = ['Placed - HVA', 'Placed - Self']
    const placedRows = validRows.filter(r => placedStatuses.includes(r['status'] ?? ''))
    if (placedRows.length > 0) {
      const alumniRows = placedRows
        .filter(r => r['learner_id'] && r['name'])
        .map(r => ({
          learner_id: r['learner_id'],
          user_id: emailToUserId.get(r['email']) ?? null,
          name: r['name'] ?? '',
          email: r['email'] || null,
          cohort_fy: r['cohort_fy'] || '2025-26',
          employment_status: 'employed',
        }))
      if (alumniRows.length > 0) {
        // ignoreDuplicates: don't overwrite if admin manually changed employment_status
        await supabase.from('alumni').upsert(alumniRows, { onConflict: 'learner_id', ignoreDuplicates: true })
      }
    }

    // ── Step 5: Delete learners no longer in the sheet ────────────────────────
    // Delete from users where role='learner' and email not in sheet
    // (ON DELETE CASCADE removes the learners row automatically)
    const sheetEmails = new Set(validRows.map((r) => r['email']))
    const { data: existingLearnerUsers } = await supabase
      .from('users')
      .select('email')
      .eq('role', 'learner')

    const toDelete = (existingLearnerUsers ?? [])
      .map((r) => r.email)
      .filter((e): e is string => !!e && !sheetEmails.has(e))

    if (toDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .in('email', toDelete)
        .eq('role', 'learner')

      if (deleteError) {
        return NextResponse.json({ success: false, error: deleteError.message }, { status: 500 })
      }
    }

    await supabase.from('sync_logs').upsert(
      { sheet_key: 'learner_roster', last_synced_at: new Date().toISOString(), records_synced: learners.length },
      { onConflict: 'sheet_key' }
    )

    return NextResponse.json({
      success: true,
      count: learners.length,
      deleted: toDelete.length,
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
