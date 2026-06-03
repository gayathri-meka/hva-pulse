import { redirect } from 'next/navigation'
import { Plus_Jakarta_Sans, Nunito } from 'next/font/google'
import CandidateHeader from '@/components/candidate/CandidateHeader'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  weight: ['400', '600', '700', '800', '900'],
  display: 'swap',
})

export default async function CandidateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) redirect('/login')

  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', user.email.toLowerCase())
    .maybeSingle()
  if (appUser) redirect('/dashboard')

  return (
    <div
      className={`${jakarta.variable} ${nunito.variable} min-h-screen bg-[#f5f7f5]`}
      style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif' }}
    >
      <CandidateHeader />
      {children}
    </div>
  )
}
