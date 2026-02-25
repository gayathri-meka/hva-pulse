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

export async function createPersona(formData: FormData) {
  const appUser = await requireAdmin()

  const name = (formData.get('name') as string).trim()
  const target_job_titles = JSON.parse((formData.get('target_job_titles') as string) || '[]')
  const required_skills = JSON.parse((formData.get('required_skills') as string) || '[]')
  const experience_min = formData.get('experience_min') ? parseInt(formData.get('experience_min') as string, 10) : null
  const experience_max = formData.get('experience_max') ? parseInt(formData.get('experience_max') as string, 10) : null
  const preferred_locations = JSON.parse((formData.get('preferred_locations') as string) || '[]')
  const remote_allowed = formData.get('remote_allowed') === 'true'
  const platforms = JSON.parse((formData.get('platforms') as string) || '[]')

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').insert({
    name,
    target_job_titles,
    required_skills,
    experience_min,
    experience_max,
    preferred_locations,
    remote_allowed,
    platforms,
    created_by: appUser.id,
  })

  revalidatePath('/outreach/personas')
}

export async function updatePersona(id: string, formData: FormData) {
  await requireAdmin()

  const name = (formData.get('name') as string).trim()
  const target_job_titles = JSON.parse((formData.get('target_job_titles') as string) || '[]')
  const required_skills = JSON.parse((formData.get('required_skills') as string) || '[]')
  const experience_min = formData.get('experience_min') ? parseInt(formData.get('experience_min') as string, 10) : null
  const experience_max = formData.get('experience_max') ? parseInt(formData.get('experience_max') as string, 10) : null
  const preferred_locations = JSON.parse((formData.get('preferred_locations') as string) || '[]')
  const remote_allowed = formData.get('remote_allowed') === 'true'
  const platforms = JSON.parse((formData.get('platforms') as string) || '[]')

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').update({
    name,
    target_job_titles,
    required_skills,
    experience_min,
    experience_max,
    preferred_locations,
    remote_allowed,
    platforms,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/outreach/personas')
}

export async function deletePersona(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').delete().eq('id', id)
  revalidatePath('/outreach/personas')
}

export async function togglePersonaActive(id: string, active: boolean) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').update({ active, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/outreach/personas')
}
