'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'

async function uploadJdAttachment(file: File, roleId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    console.error('JD upload skipped: SUPABASE_SERVICE_ROLE_KEY not set')
    return null
  }
  try {
    const admin = createClient(url, key)
    const ext   = file.name.split('.').pop() ?? 'pdf'
    const path  = `${roleId}.${ext}`
    const { error } = await admin.storage
      .from('jd-files')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) { console.error('JD upload error:', error.message); return null }
    const { data } = admin.storage.from('jd-files').getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.error('JD upload exception:', err)
    return null
  }
}

const requireAdmin = requireStaff

// ── Shared helper ──────────────────────────────────────────────────────────────

function buildStatusUpdate(status: string, note?: string, reasons?: string[]): Record<string, unknown> {
  const now = new Date().toISOString()
  const updates: Record<string, unknown> = { status }

  if (status === 'shortlisted' || status === 'not_shortlisted') {
    updates.shortlisting_decision_taken_at = now
  } else if (status === 'interviews_ongoing') {
    updates.interviews_started_at = now
  } else if (status === 'hired' || status === 'rejected') {
    updates.hiring_decision_taken_at = now
  }

  if (status === 'not_shortlisted') {
    updates.not_shortlisted_reasons = reasons ?? []
    updates.not_shortlisted_reason  = note ?? null
    updates.rejection_reasons       = []
    updates.rejection_feedback      = null
  } else if (status === 'rejected') {
    updates.rejection_reasons       = reasons ?? []
    updates.rejection_feedback      = note ?? null
    updates.not_shortlisted_reasons = []
    updates.not_shortlisted_reason  = null
  } else {
    updates.not_shortlisted_reasons = []
    updates.not_shortlisted_reason  = null
    updates.rejection_reasons       = []
    updates.rejection_feedback      = null
  }

  return updates
}

export async function createCompany(formData: FormData) {
  await requireAdmin()

  const company_name = (formData.get('company_name') as string).trim()

  const supabase = await createServerSupabaseClient()

  // Shift all existing companies down to make room at position 0
  const { data: existing } = await supabase.from('companies').select('id, sort_order')
  if (existing && existing.length > 0) {
    await Promise.all(
      existing.map((c) =>
        supabase.from('companies').update({ sort_order: (c.sort_order ?? 0) + 1 }).eq('id', c.id)
      )
    )
  }

  await supabase.from('companies').insert({ company_name, sort_order: 0 })
  revalidatePath('/placements/companies')
}

export async function updateCompany(id: string, formData: FormData) {
  await requireAdmin()

  const company_name = (formData.get('company_name') as string).trim()

  const supabase = await createServerSupabaseClient()
  await supabase.from('companies').update({ company_name }).eq('id', id)
  revalidatePath('/placements/companies')
}

export async function createRole(formData: FormData) {
  await requireAdmin()

  const company_id      = (formData.get('company_id') as string).trim()
  const role_title      = (formData.get('role_title') as string).trim()
  const location        = (formData.get('location') as string).trim()
  const salary_range    = ((formData.get('salary_range') as string) ?? '').trim() || null
  const job_description = (formData.get('job_description') as string).trim()
  const jdFile          = formData.get('jd_attachment') as File | null

  const supabase = await createServerSupabaseClient()
  const { data: newRole } = await supabase
    .from('roles')
    .insert({ company_id, role_title, location, salary_range, job_description })
    .select('id')
    .single()

  if (newRole && jdFile && jdFile.size > 0) {
    const url = await uploadJdAttachment(jdFile, newRole.id)
    if (url) await supabase.from('roles').update({ jd_attachment_url: url }).eq('id', newRole.id)
  }

  revalidatePath('/placements/companies')
  revalidatePath('/placements/applications')
}

export async function updateRole(id: string, formData: FormData) {
  await requireAdmin()

  const role_title      = (formData.get('role_title') as string).trim()
  const location        = (formData.get('location') as string).trim()
  const salary_range    = ((formData.get('salary_range') as string) ?? '').trim() || null
  const job_description = (formData.get('job_description') as string).trim()
  const jdFile          = formData.get('jd_attachment') as File | null

  const updates: Record<string, unknown> = { role_title, location, salary_range, job_description }

  if (jdFile && jdFile.size > 0) {
    const url = await uploadJdAttachment(jdFile, id)
    if (url) updates.jd_attachment_url = url
  }

  const supabase = await createServerSupabaseClient()
  await supabase.from('roles').update(updates).eq('id', id)
  revalidatePath('/placements/companies')
  revalidatePath('/placements/applications')
}

export async function closeRole(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('roles').update({ status: 'closed' }).eq('id', id)
  revalidatePath('/placements/companies')
  revalidatePath('/placements/analytics')
}

export async function reopenRole(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('roles').update({ status: 'open' }).eq('id', id)
  revalidatePath('/placements/companies')
  revalidatePath('/placements/analytics')
}

export async function updateJobDescription(id: string, jobDescription: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('roles').update({ job_description: jobDescription }).eq('id', id)
  revalidatePath('/placements/companies')
}

export async function createApplication(formData: FormData) {
  await requireAdmin()

  const role_id    = (formData.get('role_id')    as string).trim()
  const learner_id = (formData.get('learner_id') as string).trim()
  const resume_url = ((formData.get('resume_url') as string) ?? '').trim() || null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabase = key ? createClient(url, key) : await createServerSupabaseClient()

  // Resolve the learner's user_id so the application is visible on the learner dashboard
  const { data: learnerRow } = await supabase
    .from('learners')
    .select('user_id')
    .eq('learner_id', learner_id)
    .single()

  await supabase.from('applications').insert({
    role_id,
    learner_id,
    resume_url,
    user_id: learnerRow?.user_id ?? null,
  })
  revalidatePath('/placements/applications')
  revalidatePath('/placements/analytics')
}

export async function updateApplicationStatus(id: string, status: string, note?: string, reasons?: string[]) {
  await requireAdmin()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabase = key ? createClient(url, key) : await createServerSupabaseClient()

  const { error } = await supabase.from('applications').update(buildStatusUpdate(status, note, reasons)).eq('id', id)
  if (error) throw new Error(`Failed to update status: ${error.message}`)
  revalidatePath('/placements/applications')
  revalidatePath('/placements/analytics')
}

export async function bulkUpdateApplicationStatus(ids: string[], status: string, note?: string, reasons?: string[]) {
  await requireAdmin()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const supabase = key ? createClient(url, key) : await createServerSupabaseClient()

  const { error } = await supabase.from('applications').update(buildStatusUpdate(status, note, reasons)).in('id', ids)
  if (error) throw new Error(`Failed to bulk update status: ${error.message}`)
  revalidatePath('/placements/applications')
  revalidatePath('/placements/analytics')
}

export async function deleteApplication(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('applications').delete().eq('id', id)
  revalidatePath('/placements/applications')
  revalidatePath('/placements/analytics')
}

export async function deleteRole(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('roles').delete().eq('id', id)
  revalidatePath('/placements/companies')
  revalidatePath('/placements/applications')
  revalidatePath('/placements/analytics')
}

export async function deleteCompany(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('companies').delete().eq('id', id)
  revalidatePath('/placements/companies')
  revalidatePath('/placements/applications')
  revalidatePath('/placements/analytics')
}

export async function reorderCompanies(orderedIds: string[]) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from('companies').update({ sort_order: index }).eq('id', id)
    )
  )
  revalidatePath('/placements/companies')
}
