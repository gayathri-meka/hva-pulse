'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export type InterestFormPayload = {
  name: string
  phone: string
  college: string
  education_status: string
  referral_source: string
  referral_detail: string
}

export type SubmitResult = { ok: true } | { ok: false; error: string }

export async function submitInterestForm(
  payload: InterestFormPayload,
): Promise<SubmitResult> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { ok: false, error: 'You are not signed in.' }

  const email = user.email.toLowerCase()

  const name = payload.name.trim()
  const phone = payload.phone.trim()
  const college = payload.college.trim()
  const educationStatus = payload.education_status.trim()
  const referralSource = payload.referral_source.trim()
  const referralDetail = payload.referral_detail.trim()

  if (!name) return { ok: false, error: 'Please enter your name.' }
  if (!/^\d{10}$/.test(phone))
    return { ok: false, error: 'Phone must be a 10-digit number.' }
  if (!college) return { ok: false, error: 'Please enter your college name.' }
  if (!educationStatus)
    return { ok: false, error: 'Please pick an education status.' }
  if (!referralSource)
    return { ok: false, error: 'Please tell us how you heard about us.' }

  // prospects RLS allows writes only for admin/staff — the candidate flow
  // upserts via the service-role client (same pattern as /auth/callback).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date().toISOString()
  const { error } = await admin
    .from('prospects')
    .upsert(
      {
        email,
        name,
        phone,
        college,
        education_status: educationStatus,
        referral_source: referralSource,
        referral_detail: referralDetail || null,
        interest_form_submitted_at: now,
        last_seen_at: now,
      },
      { onConflict: 'email' },
    )

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admissions/prospects')
  revalidatePath('/admissions/learner-applications')

  return { ok: true }
}
