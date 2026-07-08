import { IconClock, IconConfetti, IconHeartHandshake } from '@tabler/icons-react'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { CriterionResult } from '@/lib/challengeReview'

export const dynamic = 'force-dynamic'

type Panel = {
  iconBg: string
  iconColor: string
  Icon: typeof IconClock
  eyebrow: string
  title: string
  body: string
  bullets?: string[]
}

export default async function SelectionPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user!.email!.toLowerCase()

  // challenge_decisions has RLS (admin/staff); read this candidate's own row via
  // the service-role client, filtered to their authed email.
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: decision } = await admin
    .from('challenge_decisions')
    .select('final_decision, criteria_snapshot, published_at')
    .eq('email', email)
    .maybeSingle()

  // Only reveal the outcome once the team has RELEASED it to the portal.
  const status = decision?.published_at
    ? (decision.final_decision as 'selected' | 'rejected' | undefined)
    : undefined

  let panel: Panel
  if (status === 'selected') {
    panel = {
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      Icon: IconConfetti,
      eyebrow: 'Selection',
      title: "You're through to the interview! 🎉",
      body:
        "Great work on the challenge. You've been selected for the interview round. There's nothing you need to do right now — we'll reach out to schedule your interview soon.",
    }
  } else if (status === 'rejected') {
    // Codified feedback: the failed criteria's messages, captured at decision time.
    // Only show fail feedback that is NOT flagged internal-only (income, college
    // tier, SES are sensitive fit/financial reasons we keep to the team).
    const snapshot = (decision?.criteria_snapshot ?? []) as CriterionResult[]
    const reasons = Array.isArray(snapshot)
      ? snapshot.filter((c) => c?.status === 'fail' && c?.failFeedback && !c?.internalOnly).map((c) => c.failFeedback!)
      : []
    panel = {
      iconBg: '#fee2e2',
      iconColor: '#dc2626',
      Icon: IconHeartHandshake,
      eyebrow: 'Selection',
      title: 'Not this time',
      body:
        "Thank you for taking on the challenge — we truly appreciate the effort. This time we won't be moving forward with your application, for the reasons below. We'd genuinely encourage you to build on these and apply again.",
      bullets: reasons,
    }
  } else {
    panel = {
      iconBg: '#dcfce7',
      iconColor: '#16a34a',
      Icon: IconClock,
      eyebrow: 'Selection',
      title: 'Under review',
      body:
        "We're reviewing your challenge submission. Hang tight — we'll update this page and be in touch as soon as there's news.",
    }
  }

  const { Icon } = panel

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-8 text-center sm:p-12">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundColor: panel.iconBg }}
        >
          <Icon size={28} stroke={2} style={{ color: panel.iconColor }} />
        </div>
        <div
          className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
          style={{ color: panel.iconColor }}
        >
          {panel.eyebrow}
        </div>
        <h1
          className="mb-3 text-[24px] font-black text-zinc-900 sm:text-[28px]"
          style={{ fontFamily: 'var(--font-jakarta), sans-serif', lineHeight: 1.25 }}
        >
          {panel.title}
        </h1>
        <p className="mx-auto max-w-[480px] text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
          {panel.body}
        </p>

        {panel.bullets && panel.bullets.length > 0 && (
          <ul className="mx-auto mt-5 max-w-[480px] space-y-2 text-left">
            {panel.bullets.map((b, i) => (
              <li
                key={i}
                className="rounded-xl border-[0.5px] border-red-100 bg-red-50 px-4 py-2.5 text-[13px] leading-[1.5] text-red-800"
              >
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
