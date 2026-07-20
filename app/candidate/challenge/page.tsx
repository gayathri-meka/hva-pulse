import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import {
  IconCalendarRepeat,
  IconConfetti,
  IconExternalLink,
  IconEye,
  IconSeeding,
  IconTrophy,
} from '@tabler/icons-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CHALLENGE_VIEW, candidateChallengeProgress } from '@/lib/challengeFunnel'

export const dynamic = 'force-dynamic'

// Cohort-join link on SensAI (our LMS). Interim: links directly — SensAI's own
// Google sign-in handles auth. Once the Pulse↔SensAI SSO endpoint exists, swap
// this for the Pulse /api/sensai/start route so there's no second sign-in.
const COHORT_JOIN_URL = 'https://sensai.hyperverge.org/school/hvacademy/join?cohortId=214'
const SENSAI_URL = 'https://sensai.hyperverge.org'

const jakarta = { fontFamily: 'var(--font-jakarta), sans-serif' } as const

export default async function ChallengePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  const email = user!.email!.toLowerCase()

  // prospects / challenge tables are staff-only under RLS → read this candidate's
  // own rows via the service-role client, filtered to their authed email.
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const [{ data: prospect }, { data: src }, { data: decision }] = await Promise.all([
    admin.from('prospects').select('name').eq('email', email).maybeSingle(),
    admin.from('metric_sources').select('id').eq('bq_table', CHALLENGE_VIEW).maybeSingle(),
    admin.from('challenge_decisions').select('final_decision, published_at, rejection_message').eq('email', email).maybeSingle(),
  ])
  const firstName = (prospect?.name ?? '').trim().split(' ')[0] || 'there'

  let progress = { started: false, percent: 0, attemptedAllItems: false }
  if (src) {
    const { data: rows } = await admin
      .from('metric_raw_rows')
      .select('learner_id, dimensions')
      .eq('source_id', src.id)
      .eq('learner_id', email)
    progress = candidateChallengeProgress(rows ?? [])
  }

  const released = decision?.published_at != null
  const outcome = released ? (decision!.final_decision as 'selected' | 'rejected') : undefined

  // State machine (most-advanced first).
  const state: 'selected' | 'rejected' | 'completed' | 'in_progress' | 'not_started' =
    outcome === 'selected'
      ? 'selected'
      : outcome === 'rejected'
        ? 'rejected'
        : progress.attemptedAllItems
          ? 'completed'
          : progress.started
            ? 'in_progress'
            : 'not_started'

  return (
    <main className="pb-32 sm:pb-40">
      {/* HERO */}
      <section className="sm:text-center">
        <div className="mx-auto max-w-3xl px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-10">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-4 py-2 text-[15px] font-extrabold text-[#166534] sm:text-[16px]">
              <span aria-hidden>🔥</span>
              Step 3 · Challenge
            </span>
          </div>
          <h1 className="text-[22px] font-black text-zinc-900" style={{ ...jakarta, lineHeight: 1.25 }}>
            14-Day Challenge
          </h1>
        </div>
      </section>

      {/* BODY */}
      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-3 sm:space-y-4 sm:px-6 sm:pt-4">
        {/* ── STATE CARD ──────────────────────────────────────────────── */}
        {state === 'not_started' && <NotStartedCard />}
        {state === 'in_progress' && <InProgressCard firstName={firstName} percent={progress.percent} />}
        {state === 'completed' && <CompletedCard firstName={firstName} />}
        {state === 'selected' && <SelectedCard firstName={firstName} />}
        {state === 'rejected' && <RejectedCard firstName={firstName} message={decision?.rejection_message ?? null} />}

        {/* ── "How it works" + "What we observe" only while they're still
             working the challenge — irrelevant (and tone-deaf) once there's a
             decision or the challenge is done. ─────────────────────────────── */}
        {(state === 'not_started' || state === 'in_progress') && (
          <>
            <HowItWorks />
            <WhatWeObserve />
          </>
        )}
      </div>
    </main>
  )
}

// ── State 1: not started ────────────────────────────────────────────────────
function NotStartedCard() {
  return (
    <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-5 text-center sm:p-6">
      <a
        href={COHORT_JOIN_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1f0f] px-6 py-4 text-[16px] font-extrabold text-white shadow-sm transition-all hover:bg-[#15301a] hover:shadow-md active:scale-[0.99] sm:text-[17px]"
      >
        Start the challenge
        <IconExternalLink size={18} stroke={2.5} className="transition-transform group-hover:translate-x-0.5" />
      </a>
      <p className="mx-auto mt-3 max-w-md text-[13px] leading-[1.55] text-zinc-600 sm:text-[14px]">
        You&apos;ll do this challenge on <span className="font-extrabold text-zinc-900">SensAI</span>, our learning
        platform. Tap above to join and begin — use the same email you signed up with.
      </p>
    </div>
  )
}

// ── State 2: in progress (bold bar) ─────────────────────────────────────────
function InProgressCard({ firstName, percent }: { firstName: string; percent: number }) {
  return (
    <div className="rounded-2xl border-[0.5px] border-[#bbf7d0] bg-white p-5 sm:p-6">
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#16a34a]">Keep going</div>
      <h2 className="mt-1 text-[21px] font-black text-zinc-900 sm:text-[25px]" style={{ ...jakarta, lineHeight: 1.2 }}>
        You&apos;re {percent}% there, {firstName}! 🚀
      </h2>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-zinc-600 sm:text-[14px]">
        You&apos;ve been doing great — just a bit more to go. Log in and finish what&apos;s left.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="w-11 shrink-0 text-[18px] font-black text-[#16a34a]">{percent}%</span>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[#e8f4e8]">
          <div className="h-full rounded-full bg-[#5BAE5B] transition-all" style={{ width: `${Math.max(percent, 3)}%` }} />
        </div>
      </div>

      <a
        href={SENSAI_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0f1f0f] px-6 py-4 text-[15px] font-extrabold text-white shadow-sm transition-all hover:bg-[#15301a] hover:shadow-md active:scale-[0.99] sm:text-[16px]"
      >
        Log in to SensAI &amp; finish the rest
        <IconExternalLink size={18} stroke={2.5} className="transition-transform group-hover:translate-x-0.5" />
      </a>
      <p className="mt-3 rounded-xl bg-[#f0fdf4] px-3 py-2 text-center text-[12px] font-semibold text-[#166534] sm:text-[13px]">
        A little more each day is all it takes — you&apos;re so close.
      </p>
    </div>
  )
}

// ── State 3: completed the challenge, awaiting decision ─────────────────────
function CompletedCard({ firstName }: { firstName: string }) {
  return (
    <div className="rounded-2xl border-[0.5px] border-emerald-200 bg-[#f0fdf4] p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7]">
        <IconTrophy size={30} stroke={2} className="text-[#16a34a]" />
      </div>
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#16a34a]">Challenge complete</div>
      <h2 className="mt-1.5 text-[22px] font-black text-zinc-900 sm:text-[26px]" style={{ ...jakarta, lineHeight: 1.2 }}>
        You did it, {firstName}! 🎉
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.6] text-zinc-600 sm:text-[14px]">
        You&apos;ve made it through the whole 14-Day Challenge — every task, done. Now sit tight while the HVA team
        reviews. We&apos;ll update you right here on the next steps.
      </p>
    </div>
  )
}

// ── State 4: selected + released ────────────────────────────────────────────
function SelectedCard({ firstName }: { firstName: string }) {
  return (
    <div className="rounded-2xl border-[0.5px] border-emerald-200 bg-[#f0fdf4] p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7]">
        <IconConfetti size={30} stroke={2} className="text-[#16a34a]" />
      </div>
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#16a34a]">You&apos;re selected!</div>
      <h2 className="mt-1.5 text-[22px] font-black text-zinc-900 sm:text-[26px]" style={{ ...jakarta, lineHeight: 1.2 }}>
        You&apos;re selected, {firstName}! 🎉
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.6] text-zinc-600 sm:text-[14px]">
        Congratulations — you&apos;ve been selected for the interview round. Head over to the Interview tab to pick a
        slot that works for you.
      </p>
      <Link
        href="/candidate/interview"
        className="group mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f1f0f] px-6 py-4 text-[15px] font-extrabold text-white shadow-sm transition-all hover:bg-[#15301a] hover:shadow-md active:scale-[0.99] sm:text-[16px]"
      >
        Go to the Interview tab
        <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>→</span>
      </Link>
    </div>
  )
}

// ── State 5: rejected + released — the team's chosen rejection message, shown
//   warmly. Every reason template ends with an Orbit-Track link; we lift that
//   trailing URL out of the prose and turn it into a proper CTA button.
function RejectedCard({ firstName, message }: { firstName: string; message: string | null }) {
  const fallback =
    'Thank you for taking part in the 14-Day Challenge. We won’t be moving forward with your application this cycle, but we truly appreciate the effort you put in.'
  const text = (message?.trim() || fallback).trim()

  // A URL at the very end is the Orbit invitation → pull it out for the button.
  const trailing = text.match(/(https?:\/\/[^\s]+)[.\s]*$/)
  const ctaUrl = trailing ? trailing[1] : null
  const body = ctaUrl
    ? text.slice(0, trailing!.index).replace(/[\s:—–-]+$/, '')
    : text
  // Linkify any URL still left inline in the body (defensive — usually none).
  const parts = body.split(/(https?:\/\/[^\s]+)/g)

  return (
    <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
        <IconSeeding size={30} stroke={2} className="text-zinc-500" />
      </div>
      <div className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">Challenge outcome</div>
      <h2 className="mt-1.5 text-[20px] font-black text-zinc-900 sm:text-[23px]" style={{ ...jakarta, lineHeight: 1.25 }}>
        Thank you for taking part{firstName && firstName !== 'there' ? `, ${firstName}` : ''}
      </h2>
      <p className="mx-auto mt-3 max-w-xl whitespace-pre-wrap text-left text-[13px] leading-[1.7] text-zinc-600 sm:text-center sm:text-[14px]">
        {parts.map((part, i) =>
          /^https?:\/\//.test(part) ? (
            <a key={i} href={part} target="_blank" rel="noreferrer" className="font-semibold text-[#166534] underline underline-offset-2">
              {part}
            </a>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </p>

      {ctaUrl && (
        <div className="mt-6">
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0f1f0f] px-6 py-3.5 text-[15px] font-extrabold text-white shadow-sm transition-all hover:bg-[#15301a] hover:shadow-md active:scale-[0.99] sm:text-[16px]"
          >
            Explore the Orbit Track
            <IconExternalLink size={18} stroke={2.5} className="transition-transform group-hover:translate-x-0.5" />
          </a>
          <p className="mx-auto mt-2.5 max-w-sm text-[12px] leading-[1.5] text-zinc-400 sm:text-[13px]">
            A self-paced programme — keep building your skills on your own schedule, and you&apos;re welcome to apply again.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Persistent cards ────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    <>
      It runs for <span className="font-extrabold text-zinc-900">14 days</span> — with{' '}
      <span className="font-extrabold text-zinc-900">a few tasks each day</span>.
    </>,
    <>
      Finish today&apos;s tasks, then{' '}
      <span className="font-extrabold text-zinc-900">come back tomorrow to the same link</span>.
    </>,
    <>
      The next day&apos;s tasks unlock <span className="font-extrabold text-zinc-900">24 hours later</span>.
    </>,
    <>
      Return to <span className="font-extrabold text-zinc-900">this same link every day</span> to pick up where you left
      off — no new sign-up needed.
    </>,
  ]
  return (
    <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-4 sm:p-5">
      <div className="mb-2.5 flex items-center gap-1.5 text-[13px] font-extrabold text-zinc-900 sm:text-[14px]">
        <IconCalendarRepeat size={16} stroke={2} className="text-[#16a34a]" />
        How it works
      </div>
      <ol className="space-y-2.5">
        {steps.map((text, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#dcfce7] text-[11px] font-extrabold text-[#166534]">
              {i + 1}
            </span>
            <span className="text-[13px] leading-[1.55] text-zinc-600 sm:text-[14px]">{text}</span>
          </li>
        ))}
      </ol>
      <p
        className="mt-3 rounded-xl px-3 py-2 text-[12px] font-extrabold leading-[1.5] sm:text-[13px]"
        style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
      >
        Bookmark these links:{' '}
        <a href="https://sensai.hyperverge.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
          sensai.hyperverge.org
        </a>{' '}
        and{' '}
        <a href="https://pulse.academy.hyperverge.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-80">
          pulse.academy.hyperverge.org
        </a>
      </p>
      <p className="mt-2 rounded-xl bg-[#f0fdf4] px-3 py-2 text-[12px] font-semibold leading-[1.5] text-[#166534] sm:text-[13px]">
        Tip: doing a little every day is the whole point — consistency is what we look for.
      </p>
    </div>
  )
}

function WhatWeObserve() {
  return (
    <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-4 sm:p-5">
      <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-extrabold text-zinc-900 sm:text-[14px]">
        <IconEye size={16} stroke={2} className="text-[#16a34a]" />
        What we observe
      </div>
      <p className="text-[13px] leading-[1.55] text-zinc-600 sm:text-[14px]">
        Consistency · Effort · Honesty · Comprehension · Problem-solving.
        <span className="mt-1 block">
          You don&apos;t need to be perfect, just show up and show your learning behaviour.
        </span>
      </p>
    </div>
  )
}
