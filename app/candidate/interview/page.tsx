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
    <main className="pb-32 sm:pb-40">
      {/* HERO — matches the Challenge tab's centered pill + heading */}
      <section className="sm:text-center">
        <div className="mx-auto max-w-3xl px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-10">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-4 py-2 text-[15px] font-extrabold text-[#166534] sm:text-[16px]">
              <span aria-hidden>🗓️</span>
              Step 4 · Interview
            </span>
          </div>
          <h1 className="text-[22px] font-black text-zinc-900" style={{ fontFamily: 'var(--font-jakarta), sans-serif', lineHeight: 1.25 }}>
            Book your interviews
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.55] text-zinc-600 sm:text-[14px]">
            You&apos;re selected — congratulations! 🎉 There are two interviews: book the first below, and the second opens once it&apos;s done.
          </p>
        </div>
      </section>

      {/* BODY */}
      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-3 sm:space-y-4 sm:px-6 sm:pt-4">
        <InterviewBooking state={state} />
      </div>
    </main>
  )
}
