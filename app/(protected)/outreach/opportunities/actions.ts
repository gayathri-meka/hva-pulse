'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'

const requireAdmin = requireStaff

export async function updateOpportunityStatus(id: string, status: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_opportunities').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/outreach/opportunities')
}

export async function updateOpportunityNotes(id: string, notes: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_opportunities').update({ notes: notes || null, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/outreach/opportunities')
}

export async function deleteOpportunity(id: string) {
  await requireAdmin()

  const supabase = await createServerSupabaseClient()
  await supabase.from('job_opportunities').delete().eq('id', id)
  revalidatePath('/outreach/opportunities')
}

export async function promoteToPlacement(id: string): Promise<{ error?: string }> {
  await requireAdmin()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return { error: 'Server misconfiguration' }

  const adminClient = createClient(url, key)

  // Fetch the opportunity
  const { data: opp, error: fetchErr } = await adminClient
    .from('job_opportunities')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !opp) return { error: fetchErr?.message ?? 'Opportunity not found' }

  // Check if company already exists (case-insensitive)
  const { data: existing } = await adminClient
    .from('companies')
    .select('id')
    .ilike('company_name', opp.company_name.trim())
    .limit(1)
    .maybeSingle()

  let companyId: string

  if (existing?.id) {
    companyId = existing.id
  } else {
    // Insert at sort_order 0 (top of list), shift others down
    const { data: allCompanies } = await adminClient
      .from('companies')
      .select('id, sort_order')

    await Promise.all(
      (allCompanies ?? []).map((c: { id: string; sort_order: number | null }) =>
        adminClient.from('companies').update({ sort_order: (c.sort_order ?? 0) + 1 }).eq('id', c.id)
      )
    )

    const { data: newCo, error: coErr } = await adminClient
      .from('companies')
      .insert({ company_name: opp.company_name.trim(), sort_order: 0 })
      .select('id')
      .single()

    if (coErr || !newCo) return { error: coErr?.message ?? 'Failed to create company' }
    companyId = newCo.id
  }

  // Insert the role
  const { error: roleErr } = await adminClient
    .from('roles')
    .insert({
      company_id:      companyId,
      role_title:      opp.job_title,
      location:        opp.location ?? null,
      job_description: opp.job_description ?? null,
      status:          'open',
    })

  if (roleErr) return { error: roleErr.message }

  // Mark opportunity as approved
  await adminClient
    .from('job_opportunities')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/outreach/opportunities')
  revalidatePath('/placements/companies')
  return {}
}
