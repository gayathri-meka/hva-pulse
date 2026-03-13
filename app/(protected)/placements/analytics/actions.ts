'use server'

import { revalidatePath } from 'next/cache'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export interface PlacementThresholds {
  demand_target:     number
  engagement_target: number
  conversion_target: number
}

export async function savePlacementThresholds(thresholds: PlacementThresholds) {
  const appUser = await getAppUser()
  if (!appUser || appUser.role !== 'admin') {
    throw new Error('Forbidden')
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ key: 'placement_thresholds', value: thresholds, updated_at: new Date().toISOString() })

  if (error) throw new Error(error.message)

  revalidatePath('/placements/analytics')
}
