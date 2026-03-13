'use server'

import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'

const requireAdmin = requireStaff

export async function updateAlumniRow(
  alumniId: string,
  data: {
    employment_status: string
    placed_fy:         string | null
    company:           string | null
    role:              string | null
    salary:            number | null
  }
) {
  await requireAdmin()
  const supabase = await createServerSupabaseClient()

  await supabase
    .from('alumni')
    .update({
      employment_status: data.employment_status,
      placed_fy:         data.placed_fy || null,
      updated_at:        new Date().toISOString(),
    })
    .eq('id', alumniId)

  // Replace current job if company + role provided
  if (data.company && data.role) {
    await supabase.from('alumni_jobs').delete().eq('alumni_id', alumniId).eq('is_current', true)
    await supabase.from('alumni_jobs').insert({
      alumni_id:  alumniId,
      company:    data.company,
      role:       data.role,
      salary:     data.salary,
      is_current: true,
    })
  }

  revalidatePath('/alumni')
}
