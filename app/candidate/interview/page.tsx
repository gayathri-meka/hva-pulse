import ComingSoonPanel from '@/components/candidate/ComingSoonPanel'
import { getBookingState } from './actions'
import InterviewBooking from './InterviewBooking'

export const dynamic = 'force-dynamic'

export default async function InterviewPage() {
  const state = await getBookingState()

  // Not a released-selected candidate → keep the gentle "not yet" panel.
  if (!state.eligible) {
    return (
      <ComingSoonPanel
        stage="Interview"
        description="This is where we get to know you better before making a final decision on your admission. Once you clear the challenge, you'll be able to book your interview slots here."
      />
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#16a34a]">Interview</div>
      <h1 className="mb-2 text-[24px] font-black text-zinc-900 sm:text-[28px]" style={{ fontFamily: 'var(--font-jakarta), sans-serif', lineHeight: 1.25 }}>
        Book your interviews
      </h1>
      <p className="mb-6 max-w-[540px] text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
        You&apos;re through to the interview round 🎉 There are two interviews. Pick a slot for the first — the second unlocks once you&apos;ve done the first.
      </p>
      <InterviewBooking state={state} />
    </main>
  )
}
