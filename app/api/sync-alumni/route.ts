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

    const rows = await getSheetRows(process.env.GOOGLE_ALUMNI_SHEET_ID!, 'Master')

    let count = 0

    for (const row of rows) {
      const name = row['name']?.trim()
      if (!name) continue

      const learnerId        = row['learner_id']?.trim() || null
      const email            = row['email']?.trim() || null
      const fyYear           = row['fy_year']?.trim() || '2025-26'
      const contactNumber    = row['contact_number']?.trim() || null

      const rawStatus        = row['current_status']?.trim() ?? ''
      const employmentStatus = rawStatus.toLowerCase() === 'unemployed' ? 'unemployed' : 'employed'

      // Parse placement_month as a date
      const rawPlacementMonth = row['placement_month']?.trim()
      let placementMonth: string | null = null
      if (rawPlacementMonth) {
        const d = new Date(rawPlacementMonth)
        placementMonth = isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
      }

      // Find salary key — look for key containing 'salary'
      const salaryKey = Object.keys(row).find((k) => k.includes('salary'))
      let salary: number | null = null
      if (salaryKey) {
        const parsed = parseFloat(row[salaryKey])
        if (!isNaN(parsed)) salary = parsed
      }

      const company = row['company']?.trim() || null
      const role    = row['role']?.trim() || null

      // Upsert alumni
      let alumniId: string | null = null

      if (learnerId) {
        // Upsert on learner_id
        const alumniRow = {
          learner_id:        learnerId,
          name,
          email,
          fy_year:           fyYear,
          employment_status: employmentStatus,
          contact_number:    contactNumber,
          updated_at:        new Date().toISOString(),
        }
        const { data: upserted, error: upsertErr } = await supabase
          .from('alumni')
          .upsert(alumniRow, { onConflict: 'learner_id' })
          .select('id')
          .single()

        if (upsertErr || !upserted) continue
        alumniId = upserted.id
      } else {
        // No learner_id: check by name + fy_year to avoid duplicates
        const { data: existing } = await supabase
          .from('alumni')
          .select('id')
          .eq('name', name)
          .eq('fy_year', fyYear)
          .maybeSingle()

        if (existing) {
          alumniId = existing.id
          // Update status
          await supabase
            .from('alumni')
            .update({
              email,
              employment_status: employmentStatus,
              contact_number:    contactNumber,
              updated_at:        new Date().toISOString(),
            })
            .eq('id', alumniId)
        } else {
          const { data: inserted, error: insertErr } = await supabase
            .from('alumni')
            .insert({
              name,
              email,
              fy_year:           fyYear,
              employment_status: employmentStatus,
              contact_number:    contactNumber,
            })
            .select('id')
            .single()

          if (insertErr || !inserted) continue
          alumniId = inserted.id
        }
      }

      // Insert job if company + role present
      if (alumniId && company && role) {
        // Delete existing is_current=true jobs for this alumni
        await supabase
          .from('alumni_jobs')
          .delete()
          .eq('alumni_id', alumniId)
          .eq('is_current', true)

        await supabase.from('alumni_jobs').insert({
          alumni_id:       alumniId,
          company,
          role,
          salary,
          placement_month: placementMonth,
          is_current:      true,
        })
      }

      count++
    }

    await supabase.from('sync_logs').upsert(
      { sheet_key: 'alumni_roster', last_synced_at: new Date().toISOString(), records_synced: count },
      { onConflict: 'sheet_key' }
    )

    return NextResponse.json({ success: true, count })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
