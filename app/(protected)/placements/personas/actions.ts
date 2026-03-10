'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'

const requireAdmin = requireStaff

function parseJsonField(value: FormDataEntryValue | null, fallback: unknown[] = []): unknown[] {
  try {
    return JSON.parse((value as string) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

export async function createPersona(formData: FormData) {
  const appUser = await requireAdmin()

  const name = (formData.get('name') as string).trim()
  const target_job_titles = parseJsonField(formData.get('target_job_titles'))
  const required_skills = parseJsonField(formData.get('required_skills'))
  const experience_min = formData.get('experience_min') ? parseInt(formData.get('experience_min') as string, 10) : null
  const experience_max = formData.get('experience_max') ? parseInt(formData.get('experience_max') as string, 10) : null
  const preferred_locations = parseJsonField(formData.get('preferred_locations'))
  const remote_allowed = formData.get('remote_allowed') === 'true'
  const entry_level_only = formData.get('entry_level_only') === 'true'
  const platforms = parseJsonField(formData.get('platforms'))

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').insert({
    name,
    target_job_titles,
    required_skills,
    experience_min,
    experience_max,
    preferred_locations,
    remote_allowed,
    entry_level_only,
    platforms,
    created_by: appUser.id,
  })

  revalidatePath('/placements/personas')
}

export async function updatePersona(id: string, formData: FormData) {
  await requireAdmin()

  const name = (formData.get('name') as string).trim()
  const target_job_titles = parseJsonField(formData.get('target_job_titles'))
  const required_skills = parseJsonField(formData.get('required_skills'))
  const experience_min = formData.get('experience_min') ? parseInt(formData.get('experience_min') as string, 10) : null
  const experience_max = formData.get('experience_max') ? parseInt(formData.get('experience_max') as string, 10) : null
  const preferred_locations = parseJsonField(formData.get('preferred_locations'))
  const remote_allowed = formData.get('remote_allowed') === 'true'
  const entry_level_only = formData.get('entry_level_only') === 'true'
  const platforms = parseJsonField(formData.get('platforms'))

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').update({
    name,
    target_job_titles,
    required_skills,
    experience_min,
    experience_max,
    preferred_locations,
    remote_allowed,
    entry_level_only,
    platforms,
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  revalidatePath('/placements/personas')
}

export async function deletePersona(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').delete().eq('id', id)
  revalidatePath('/placements/personas')
}

export async function togglePersonaActive(id: string, active: boolean) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_personas').update({ active, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/placements/personas')
}
