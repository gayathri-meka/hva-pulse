'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'

async function requireLearner() {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'learner') redirect('/login')
  return appUser
}

// Lookup the text learner_id (domain field) for admin UI compat
async function getLearnerDomainId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data } = await supabase
    .from('learners')
    .select('learner_id')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.learner_id ?? null
}

export async function applyToRole(
  roleId: string,
  resumeUrl: string | null,
): Promise<{ error?: string }> {
  const appUser = await requireLearner()
  const supabase = await createServerSupabaseClient()

  // Prevent duplicate applications
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('role_id', roleId)
    .eq('user_id', appUser.id)
    .maybeSingle()

  if (existing) return { error: 'You have already applied to this role.' }

  const learnerDomainId = await getLearnerDomainId(supabase, appUser.id)

  const { error } = await supabase.from('applications').insert({
    role_id: roleId,
    user_id: appUser.id,
    learner_id: learnerDomainId ?? appUser.id, // text field for admin UI compat
    status: 'applied',
    resume_url: resumeUrl,
  })

  if (error) return { error: error.message }

  revalidatePath('/learner')
  revalidatePath(`/learner/roles/${roleId}`)
  return {}
}

export async function markNotInterested(roleId: string, reasons: string[] = []): Promise<{ error?: string }> {
  const appUser = await requireLearner()
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase.from('role_preferences').upsert(
    { user_id: appUser.id, role_id: roleId, preference: 'not_interested', reasons },
    { onConflict: 'user_id,role_id' },
  )

  if (error) return { error: error.message }

  revalidatePath('/learner')
  return {}
}

export async function removeNotInterested(roleId: string): Promise<{ error?: string }> {
  const appUser = await requireLearner()
  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('role_preferences')
    .delete()
    .eq('user_id', appUser.id)
    .eq('role_id', roleId)

  if (error) return { error: error.message }

  revalidatePath('/learner')
  return {}
}

export async function uploadResume(formData: FormData): Promise<{ error?: string }> {
  const appUser = await requireLearner()

  const file = formData.get('file') as File
  const versionName = (formData.get('version_name') as string | null)?.trim()

  if (!file || file.size === 0) return { error: 'No file selected.' }
  if (file.type !== 'application/pdf') return { error: 'Only PDF files are allowed.' }
  if (!versionName) return { error: 'Version name is required.' }

  const supabase = await createServerSupabaseClient()

  const path = `${appUser.id}/${Date.now()}.pdf`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(path, file, { contentType: 'application/pdf' })

  if (uploadError) return { error: uploadError.message }

  const {
    data: { publicUrl },
  } = supabase.storage.from('resumes').getPublicUrl(uploadData.path)

  const { error } = await supabase.from('resumes').insert({
    user_id: appUser.id,
    file_url: publicUrl,
    version_name: versionName,
  })

  if (error) {
    await supabase.storage.from('resumes').remove([path])
    return { error: error.message }
  }

  revalidatePath('/learner/profile')
  return {}
}

export async function deleteResume(id: string, fileUrl: string): Promise<{ error?: string }> {
  const appUser = await requireLearner()
  const supabase = await createServerSupabaseClient()

  // Extract storage path from public URL
  const storagePath = fileUrl.split('/storage/v1/object/public/resumes/')[1]
  if (storagePath) {
    await supabase.storage.from('resumes').remove([storagePath])
  }

  const { error } = await supabase
    .from('resumes')
    .delete()
    .eq('id', id)
    .eq('user_id', appUser.id)

  if (error) return { error: error.message }

  revalidatePath('/learner/profile')
  return {}
}
