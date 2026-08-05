import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getAppUser } from '@/lib/auth'
import type { TicketCategory, SpocUser } from '@/lib/tickets'
import CategoriesManager from './CategoriesManager'

export const dynamic = 'force-dynamic'

export default async function TicketSettingsPage() {
  const user = await getAppUser()
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/tickets')

  const supabase = await createServerSupabaseClient()
  const [{ data: catData }, { data: spocData }] = await Promise.all([
    supabase.from('ticket_categories').select('*').order('sort_order', { ascending: true }),
    supabase.from('users').select('id, email, name, role').in('role', ['admin', 'staff']).order('name', { ascending: true }),
  ])

  const categories = (catData ?? []) as TicketCategory[]
  const spocs = (spocData ?? []) as SpocUser[]

  return (
    <div className="max-w-3xl">
      <Link href="/tickets" className="text-sm text-zinc-500 hover:text-zinc-700">← Back to tickets</Link>
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Ticket categories &amp; SPOCs</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Edits here take effect immediately - the <code className="rounded bg-zinc-100 px-1">/tech-support</code> Slack form and SPOC assignment read from these tables at request time (no redeploy).
        </p>
      </div>

      <CategoriesManager categories={categories} spocs={spocs} />
    </div>
  )
}
