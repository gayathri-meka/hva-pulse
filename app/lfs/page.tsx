import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import LFsTable from './LFsTable'

export const dynamic = 'force-dynamic'

export default async function LFsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lfs } = await supabase.from('lfs').select('*').order('name')

  async function addLF(formData: FormData) {
    'use server'
    const name = (formData.get('name') as string).trim()
    const email = (formData.get('email') as string).trim()
    if (!name || !email) return
    const supabase = await createServerSupabaseClient()
    await supabase.from('lfs').insert({ name, email })
    revalidatePath('/lfs')
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Learning Facilitators</h1>
      </div>

      <form action={addLF} className="mb-8 flex gap-3">
        <input
          name="name"
          type="text"
          placeholder="Name"
          required
          className="rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Add
        </button>
      </form>

      <LFsTable lfs={lfs ?? []} />
    </div>
  )
}
