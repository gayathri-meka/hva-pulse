import { redirect } from 'next/navigation'
import { Plus_Jakarta_Sans, Nunito } from 'next/font/google'
import { createClient } from '@supabase/supabase-js'
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

  const email = user.email.toLowerCase()
  const { data: appUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (appUser) redirect('/dashboard')

  // Read stage-completion flags. prospects RLS only allows admin/staff reads,
  // so we hop via the service-role client. Same pattern as the interest-form
  // page and the admin views.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const [{ data: prospect }, { data: decision }, { data: interviewDecision }] = await Promise.all([
    admin.from('prospects').select('interest_form_submitted_at').eq('email', email).maybeSingle(),
    admin.from('challenge_decisions').select('final_decision, published_at').eq('email', email).maybeSingle(),
    admin.from('interview_decisions').select('final').eq('candidate_email', email).maybeSingle(),
  ])

  const completedStages: string[] = []
  if (prospect?.interest_form_submitted_at) completedStages.push('interest-form')
  // Once a decision is released, the challenge is behind them → mark it green.
  if (decision?.published_at) completedStages.push('challenge')

  // Stages the candidate can't reach yet → the stepper greys them out (no more
  // "coming soon" pages). Interview unlocks for a released "selected" challenge
  // decision; Selection unlocks only once the team makes the final "selected"
  // call after the interviews (a rejection leaves Selection greyed).
  const interviewUnlocked = decision?.final_decision === 'selected' && decision?.published_at != null
  const selectionUnlocked = interviewDecision?.final === 'selected'
  const lockedStages: string[] = []
  if (!interviewUnlocked) lockedStages.push('interview')
  if (!selectionUnlocked) lockedStages.push('selection')

  return (
    <div
      className={`${jakarta.variable} ${nunito.variable} min-h-screen bg-[#f5f7f5]`}
      style={{ fontFamily: 'var(--font-nunito), system-ui, sans-serif' }}
    >
      <CandidateHeader completedStages={completedStages} lockedStages={lockedStages} />
      {children}
    </div>
  )
}
