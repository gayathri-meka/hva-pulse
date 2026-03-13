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

    // Log detected headers for debugging
    const detectedHeaders = rows[0] ? Object.keys(rows[0]) : []

    let count = 0
    const errors: string[] = []

    for (const row of rows) {
      const name = row['name']?.trim()
      if (!name) continue

      const learnerId        = row['learner_id']?.trim() || null
      const email            = row['email']?.trim() || null
      const cohortFy         = row['cohort_fy']?.trim() || row['fy_year']?.trim() || '2025-26'
      const placedFy         = row['placed_fy']?.trim() || null
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

      // Try common header variants (sheet headers vary)
      const companyKey = Object.keys(row).find((k) => k === 'company' || k === 'company_name' || k === 'current_company' || k === 'employer')
      const roleKey    = Object.keys(row).find((k) => k === 'role' || k === 'role_title' || k === 'designation' || k === 'position' || k === 'job_title')
      const company = companyKey ? row[companyKey]?.trim() || null : null
      const role    = roleKey    ? row[roleKey]?.trim()    || null : null

      // Upsert alumni
      let alumniId: string | null = null

      if (learnerId) {
        const alumniRow = {
          learner_id:        learnerId,
          name,
          email,
          cohort_fy:         cohortFy,
          placed_fy:         placedFy,
          employment_status: employmentStatus,
          contact_number:    contactNumber,
          updated_at:        new Date().toISOString(),
        }
        const { data: upserted, error: upsertErr } = await supabase
          .from('alumni')
          .upsert(alumniRow, { onConflict: 'learner_id' })
          .select('id')
          .single()

        if (upsertErr) {
          errors.push(`Row "${name}": learner_id upsert failed (${upsertErr.message}), falling back to name+cohort`)
          // fall through to name+cohort path below (alumniId stays null)
        } else if (upserted) {
          alumniId = upserted.id
        } else {
          // Conflict resolved but no row returned — fetch it
          const { data: fetched } = await supabase
            .from('alumni')
            .select('id')
            .eq('learner_id', learnerId)
            .maybeSingle()
          if (fetched) alumniId = fetched.id
        }
      }

      // name+cohort dedup path (runs if no learnerId OR if learnerId upsert failed)
      if (!alumniId) {
        const { data: existing } = await supabase
          .from('alumni')
          .select('id')
          .eq('name', name)
          .eq('cohort_fy', cohortFy)
          .maybeSingle()

        if (existing) {
          alumniId = existing.id
          await supabase
            .from('alumni')
            .update({
              email,
              placed_fy:         placedFy,
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
              cohort_fy:         cohortFy,
              placed_fy:         placedFy,
              employment_status: employmentStatus,
              contact_number:    contactNumber,
            })
            .select('id')
            .single()

          if (insertErr || !inserted) {
            errors.push(`Row "${name}": insert failed (${insertErr?.message ?? 'no data returned'})`)
            continue
          }
          alumniId = inserted.id
        }
      }

      // Update or insert current job (never delete before insert — avoids data loss on re-sync)
      if (alumniId && company && role) {
        const { data: existingJob } = await supabase
          .from('alumni_jobs')
          .select('id')
          .eq('alumni_id', alumniId)
          .eq('is_current', true)
          .maybeSingle()

        if (existingJob) {
          await supabase.from('alumni_jobs').update({ company, role, salary, placement_month: placementMonth }).eq('id', existingJob.id)
        } else {
          await supabase.from('alumni_jobs').insert({ alumni_id: alumniId, company, role, salary, placement_month: placementMonth, is_current: true })
        }
      }

      count++
    }

    await supabase.from('sync_logs').upsert(
      { sheet_key: 'alumni_roster', last_synced_at: new Date().toISOString(), records_synced: count },
      { onConflict: 'sheet_key' }
    )

    return NextResponse.json({ success: true, count, errors, detectedHeaders })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
