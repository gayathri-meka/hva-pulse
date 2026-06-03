import { IconClock } from '@tabler/icons-react'

export default function ComingSoonPanel({
  stage,
  description,
}: {
  stage: string
  description: string
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-8 text-center sm:p-12">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dcfce7]">
          <IconClock size={28} stroke={2} className="text-[#16a34a]" />
        </div>
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-[#16a34a]">
          {stage}
        </div>
        <h1
          className="mb-3 text-[24px] font-black text-zinc-900 sm:text-[28px]"
          style={{
            fontFamily: 'var(--font-jakarta), sans-serif',
            lineHeight: 1.25,
          }}
        >
          Coming soon
        </h1>
        <p className="mx-auto max-w-[480px] text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
          {description}
        </p>
      </div>
    </main>
  )
}
