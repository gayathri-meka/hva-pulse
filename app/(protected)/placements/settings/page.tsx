import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import PlacementSettingsPanel from '@/components/placements/PlacementSettingsPanel'

export const dynamic = 'force-dynamic'

export default async function PlacementSettingsPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role === 'learner') redirect('/placements/analytics')

  const supabase = await createServerSupabaseClient()

  const [{ data: nsRow }, { data: rejRow }, { data: threshRow }, { data: tatRow }] = await Promise.all([
    supabase.from('settings').select('value').eq('key', 'ns_reasons').maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'rejection_reasons').maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'placement_thresholds').maybeSingle(),
    supabase.from('settings').select('value').eq('key', 'tat_cutoff_date').maybeSingle(),
  ])

  const defaults = {
    nsReasons: [
      'Skill Mismatch', 'Eligibility Mismatch', 'Location Mismatch',
      'Blacklisted', 'Joining Date Mismatch', 'Other',
    ],
    rejectionReasons: [
      'Gap in technical skills', 'Gap in communication skills',
      "Didn't submit assignment", 'Interview no-show', 'Copied', 'Other',
    ],
    thresholds: { demand_target: 10, engagement_target: 5, conversion_target: 0.5 },
    tatCutoffDate: '2026-03-05',
  }

  return (
    <div className={appUser.role !== 'admin' ? 'guest-readonly' : ''}>
    <PlacementSettingsPanel
      nsReasons={(nsRow?.value as string[]) ?? defaults.nsReasons}
      rejectionReasons={(rejRow?.value as string[]) ?? defaults.rejectionReasons}
      thresholds={(threshRow?.value as typeof defaults.thresholds) ?? defaults.thresholds}
      tatCutoffDate={(tatRow?.value as string) ?? defaults.tatCutoffDate}
    />
    </div>
  )
}
