import { createClient } from '@supabase/supabase-js'
import { IconClock, IconConfetti } from '@tabler/icons-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// The FINAL selection (after both interviews). The team makes the call in the
// Interviews → Review tab; this page reflects interview_decisions.final for the
// signed-in candidate. Onboarding beyond "you're selected" is a later build.
export default async function SelectionPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user?.email?.toLowerCase() ?? ''

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: decision } = await admin
    .from('interview_decisions')
    .select('final')
    .eq('candidate_email', email)
    .maybeSingle()
  const selected = decision?.final === 'selected'

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      {selected ? (
        <div className="rounded-[20px] border-[0.5px] border-emerald-200 bg-[#f0fdf4] p-8 text-center sm:p-12">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7]">
            <IconConfetti size={28} stroke={2} className="text-[#16a34a]" />
          </div>
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#16a34a]">Selection</div>
          <h1 className="mb-3 text-[24px] font-black text-zinc-900 sm:text-[28px]" style={{ fontFamily: 'var(--font-jakarta), sans-serif', lineHeight: 1.25 }}>
            You&apos;re selected! 🎉
          </h1>
          <p className="mx-auto max-w-[480px] text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
            Congratulations — you&apos;ve been selected into the HyperVerge Academy fellowship. The team will reach out
            with your onboarding details and next steps very soon. Welcome aboard!
          </p>
        </div>
      ) : (
        <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-8 text-center sm:p-12">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#f4f4f5' }}>
            <IconClock size={28} stroke={2} style={{ color: '#71717a' }} />
          </div>
          <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">Selection</div>
          <h1 className="mb-3 text-[24px] font-black text-zinc-900 sm:text-[28px]" style={{ fontFamily: 'var(--font-jakarta), sans-serif', lineHeight: 1.25 }}>
            Not yet
          </h1>
          <p className="mx-auto max-w-[480px] text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
            Your final selection result will appear here once your interviews are complete and the team has made a
            decision. Hang tight — we&apos;ll update this page as soon as there&apos;s news.
          </p>
        </div>
      )}
    </main>
  )
}
