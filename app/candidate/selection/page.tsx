import { IconClock } from '@tabler/icons-react'

export const dynamic = 'force-dynamic'

// The FINAL selection (after interviews) — distinct from the challenge-level
// decision shown under the Challenge step. That flow isn't built yet, so this is
// a placeholder; do NOT surface challenge_decisions here.
export default function SelectionPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-8 text-center sm:p-12">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: '#f4f4f5' }}>
          <IconClock size={28} stroke={2} style={{ color: '#71717a' }} />
        </div>
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">Selection</div>
        <h1
          className="mb-3 text-[24px] font-black text-zinc-900 sm:text-[28px]"
          style={{ fontFamily: 'var(--font-jakarta), sans-serif', lineHeight: 1.25 }}
        >
          Coming soon
        </h1>
        <p className="mx-auto max-w-[480px] text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
          Your final selection result will appear here once your interviews are complete. Hang tight — we&apos;ll update
          this page and be in touch as soon as there&apos;s news.
        </p>
      </div>
    </main>
  )
}
