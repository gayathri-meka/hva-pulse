import { redirect } from 'next/navigation'
import { getAppUser, canSeePII } from '@/lib/auth'
import { maskName, maskEmail } from '@/lib/pii'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import NotInterestedTable, { type NotInterestedRow } from '@/components/placements/NotInterestedTable'

export const dynamic = 'force-dynamic'

export default async function NotInterestedPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'staff' && appUser.role !== 'guest') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()

  const [
    { data: roles },
    { data: companies },
    { data: rawLearners },
    { data: rawPreferences },
  ] = await Promise.all([
    supabase.from('roles').select('id, company_id, role_title'),
    supabase.from('companies').select('id, company_name'),
    supabase.from('learners').select('user_id, learner_id, batch_name, lf_name, users!learners_user_id_fkey(name)'),
    supabase.from('role_preferences').select('user_id, role_id, reasons').eq('preference', 'not_interested'),
  ])

  const showPII = canSeePII(appUser.role)
  const companyMap  = Object.fromEntries((companies ?? []).map((c) => [c.id, c.company_name]))
  const roleInfoMap = new Map((roles ?? []).map((r) => [r.id, { role_title: r.role_title, company_name: companyMap[r.company_id] ?? '' }]))

  type RawLearner = { user_id: string | null; learner_id: string; batch_name: string; lf_name: string; users: { name: string } | null }
  const userIdToLearner = new Map(
    ((rawLearners ?? []) as unknown as RawLearner[])
      .filter((l) => l.user_id)
      .map((l) => [l.user_id!, { name: l.users?.name ?? '', batch: l.batch_name ?? '', lf: l.lf_name ?? '' }])
  )

  const rows: NotInterestedRow[] = (rawPreferences ?? [])
    .filter((p) => p.user_id && roleInfoMap.has(p.role_id))
    .map((p) => {
      const learner  = userIdToLearner.get(p.user_id!)
      const roleInfo = roleInfoMap.get(p.role_id)!
      return {
        user_id:      p.user_id!,
        role_id:      p.role_id,
        learner_name: showPII ? (learner?.name ?? '') : maskName(learner?.name, p.user_id!),
        batch:        learner?.batch ?? '',
        lf:           learner?.lf   ?? '',
        company_name: roleInfo.company_name,
        role_title:   roleInfo.role_title,
        reasons:      (p.reasons as string[]) ?? [],
      }
    })
    .sort((a, b) => a.learner_name.localeCompare(b.learner_name))

  return (
    <div>
      <NotInterestedTable rows={rows} />
    </div>
  )
}
