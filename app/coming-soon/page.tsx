import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import SignOutButton from './SignOutButton'

export const dynamic = 'force-dynamic'

export default async function ComingSoonPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email)
    .maybeSingle()
  if (appUser) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex justify-center">
            <Image
              src="/Icon/Light%20BG.png"
              alt="HVA"
              width={391}
              height={500}
              className="h-14 w-auto"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">HVA Pulse</h1>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Coming soon</h2>
          <p className="mt-3 text-sm text-zinc-500">
            Thanks for signing in, {user.email}. We&apos;re building the experience for you and will be in touch soon.
          </p>
          <div className="mt-6">
            <SignOutButton />
          </div>
        </div>
      </div>
    </main>
  )
}
