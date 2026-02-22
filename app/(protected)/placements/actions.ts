'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

async function requireAdmin() {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'admin') redirect('/dashboard')
  return appUser
}

export async function createCompany(formData: FormData) {
  await requireAdmin()

  const company_name = (formData.get('company_name') as string).trim()

  const supabase = await createServerSupabaseClient()
  await supabase.from('companies').insert({ company_name })
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

  const company_id = (formData.get('company_id') as string).trim()
  const role_title = (formData.get('role_title') as string).trim()
  const location = (formData.get('location') as string).trim()
  const salary_range = ((formData.get('salary_range') as string) ?? '').trim() || null
  const job_description = (formData.get('job_description') as string).trim()

  const supabase = await createServerSupabaseClient()
  await supabase.from('roles').insert({ company_id, role_title, location, salary_range, job_description })
  revalidatePath('/placements/companies')
  revalidatePath('/placements/applications')
}

export async function updateRole(id: string, formData: FormData) {
  await requireAdmin()

  const role_title = (formData.get('role_title') as string).trim()
  const location = (formData.get('location') as string).trim()
  const salary_range = ((formData.get('salary_range') as string) ?? '').trim() || null
  const job_description = (formData.get('job_description') as string).trim()

  const supabase = await createServerSupabaseClient()
  await supabase.from('roles').update({ role_title, location, salary_range, job_description }).eq('id', id)
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

  const role_id = (formData.get('role_id') as string).trim()
  const learner_id = (formData.get('learner_id') as string).trim()
  const resume_url = ((formData.get('resume_url') as string) ?? '').trim() || null

  const supabase = await createServerSupabaseClient()
  await supabase.from('applications').insert({ role_id, learner_id, resume_url })
  revalidatePath('/placements/applications')
  revalidatePath('/placements/analytics')
}

export async function updateApplicationStatus(id: string, status: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('applications').update({ status }).eq('id', id)
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
