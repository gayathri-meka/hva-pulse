import { redirect } from 'next/navigation'
import { getAppUser } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LearnerImpersonationPicker, {
  type LearnerOption,
} from '@/components/learner-view/LearnerImpersonationPicker'

export const dynamic = 'force-dynamic'

export default async function LearnerViewPage() {
  const appUser = await getAppUser()
  if (!appUser) redirect('/login')
  if (appUser.role !== 'admin' && appUser.role !== 'staff') redirect('/dashboard')

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('learners')
    .select('learner_id, batch_name, user_id, users!learners_user_id_fkey(id, name, email)')
    .eq('is_current_cohort', true)
    .order('batch_name')

  const learners: LearnerOption[] = (data ?? [])
    .map((l) => {
      const u = l.users as unknown as { id: string; name: string | null; email: string } | null
      if (!u?.id) return null
      return {
        user_id: u.id,
        name:    u.name ?? l.learner_id,
        email:   u.email ?? '',
        batch:   l.batch_name ?? null,
      }
    })
    .filter((l): l is LearnerOption => l !== null)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Learner view</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Pick a learner to see exactly what they see on Pulse. Read-only — write actions are disabled while viewing as a learner.
        </p>
      </div>

      <LearnerImpersonationPicker learners={learners} />
    </div>
  )
}
