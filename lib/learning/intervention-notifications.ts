import type { SupabaseClient } from '@supabase/supabase-js'
import type { Notification } from '@/components/notifications/NotificationBell'
import { maskName } from '@/lib/pii'

const ACTION_ITEM_PREFIX = 'action-item:'

interface Intervention {
  description:  string
  owner:        string
  due_date:     string | null
  completed_at: string | null
}

interface CaseRow {
  id:           string
  learner_id:   string
  interventions: Intervention[] | null
}

interface LearnerJoin {
  learner_id: string
  users: { name: string } | null
}

/**
 * Returns synthesized "action item due/overdue" notifications.
 * Computed live from active cases — not persisted, no read state.
 * The list is sorted most-overdue-first.
 */
export async function computeInterventionNotifications(
  supabase: SupabaseClient,
  showPII:  boolean,
): Promise<Notification[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()

  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() + 2)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const [{ data: ivs }, { data: learners }] = await Promise.all([
    supabase
      .from('cases')
      .select('id, learner_id, interventions')
      .neq('status', 'closed'),
    supabase
      .from('learners')
      .select('learner_id, users!learners_user_id_fkey(name)'),
  ])

  const learnerNameById = new Map<string, string>()
  for (const l of (learners ?? []) as unknown as LearnerJoin[]) {
    const real = l.users?.name ?? l.learner_id
    learnerNameById.set(l.learner_id, showPII ? real : maskName(real, l.learner_id))
  }

  const nowIso = new Date().toISOString()
  const out: { n: Notification; urgency: number }[] = []

  for (const iv of (ivs ?? []) as unknown as CaseRow[]) {
    const items = iv.interventions ?? []
    const learnerName = learnerNameById.get(iv.learner_id) ?? iv.learner_id

    items.forEach((item, idx) => {
      if (item.completed_at) return
      if (!item.due_date) return
      if (item.due_date > cutoffStr) return

      const due = new Date(item.due_date)
      due.setHours(0, 0, 0, 0)
      const days = Math.round((due.getTime() - todayMs) / 86_400_000)

      let body: string
      if (days === 0)      body = `Due today · ${learnerName}`
      else if (days < 0)   body = `${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} overdue · ${learnerName}`
      else                 body = `Due in ${days} day${days !== 1 ? 's' : ''} · ${learnerName}`

      out.push({
        urgency: days, // smaller (more negative) = more overdue → top of list
        n: {
          id:         `${ACTION_ITEM_PREFIX}${iv.id}:${idx}`,
          type:       'intervention',
          title:      `${item.owner || 'Unassigned'}: ${item.description}`,
          body,
          link:       `/learning?filter=cases&view=learner&learner=${iv.learner_id}`,
          is_read:    false,
          created_at: nowIso,
        },
      })
    })
  }

  out.sort((a, b) => a.urgency - b.urgency)
  return out.map((x) => x.n)
}
