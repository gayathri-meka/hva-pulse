import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requireStaff } from '@/lib/auth'
import { canActOnTicket, type Ticket, type TicketStatus, type TicketCategory, type SpocUser } from '@/lib/tickets'
import TicketsTable from './TicketsTable'

export const dynamic = 'force-dynamic'

export default async function TicketsPage() {
  const user = await requireStaff()
  if (!user) redirect('/login')

  const supabase = await createServerSupabaseClient()
  const [{ data }, { data: catData }, { data: spocData }] = await Promise.all([
    supabase.from('tickets').select('*').order('created_at', { ascending: false }),
    supabase.from('ticket_categories').select('*').order('sort_order', { ascending: true }),
    // SPOCs are the app's admin/staff users.
    supabase.from('users').select('id, email, name, role').in('role', ['admin', 'staff']).order('name', { ascending: true }),
  ])

  const tickets = (data ?? []) as Ticket[]
  const categories = (catData ?? []) as TicketCategory[]
  const spocs = (spocData ?? []) as SpocUser[]

  // Attach a per-row `canAct` so the table only shows action buttons where allowed.
  const rows = tickets.map((t) => ({ ...t, canAct: canActOnTicket(user, t) }))

  const count = (s: TicketStatus) => tickets.filter((t) => t.status === s && !t.is_test).length
  const openCount = count('open')
  const escalatedCount = count('escalated')
  const closedCount = count('closed')

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Tech Support</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {openCount} open · {escalatedCount} escalated · {closedCount} closed
          </p>
        </div>
        {user.role === 'admin' && (
          <a href="/tickets/settings" className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Manage categories
          </a>
        )}
      </div>

      <TicketsTable rows={rows} categories={categories} spocs={spocs} />
    </div>
  )
}
