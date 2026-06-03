import Link from 'next/link'
import {
  IconArrowRight,
  IconBriefcase,
  IconBuildingSkyscraper,
  IconChevronRight,
  IconDeviceMobile,
  IconTarget,
  IconUsers,
  type Icon as TablerIcon,
} from '@tabler/icons-react'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const STAGES: { name: string; slug: string; description: string }[] = [
  {
    name: 'Welcome',
    slug: 'welcome',
    description: 'Learn more about the programme here.',
  },
  {
    name: 'Interest Form',
    slug: 'interest-form',
    description:
      "Fill this form if you're interested in joining HVA. Tell us about yourself by answering a few quick questions.",
  },
  {
    name: 'Challenge',
    slug: 'challenge',
    description:
      'Complete this 14-day challenge to show you have what it takes.',
  },
  {
    name: 'Interview',
    slug: 'interview',
    description:
      'This is where we get to know you better before making a final decision on your admission.',
  },
  {
    name: 'Selection',
    slug: 'selection',
    description: 'Find out the status of your admission to HVA.',
  },
]

export default async function WelcomePage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const email = user!.email!.toLowerCase()

  const { data: prospect } = await supabase
    .from('prospects')
    .select('name')
    .eq('email', email)
    .maybeSingle()

  const metadata = (user!.user_metadata ?? {}) as Record<string, unknown>
  const metadataName =
    (typeof metadata.full_name === 'string' && metadata.full_name) ||
    (typeof metadata.name === 'string' && metadata.name) ||
    null

  const fullName = prospect?.name || metadataName
  const firstName = fullName?.trim().split(/\s+/)[0] ?? null
  const greeting = firstName ? `Welcome, ${firstName}!` : 'Welcome!'

  return (
    <main className="pb-32 sm:pb-40">
      {/* HERO */}
      <section className="sm:text-center">
        <div className="mx-auto max-w-3xl px-5 pb-5 pt-7 sm:px-8 sm:pb-6 sm:pt-10">
          <div className="mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dcfce7] px-4 py-2 text-[15px] font-extrabold text-[#166534] sm:text-[16px]">
              <span aria-hidden>👋</span>
              {greeting}
            </span>
          </div>
          <h1
            className="mb-3 text-[22px] font-black text-zinc-900"
            style={{
              fontFamily: 'var(--font-jakarta), sans-serif',
              lineHeight: 1.25,
            }}
          >
            Your journey to becoming job-ready starts here
          </h1>
          <p className="text-[14px] leading-[1.6] text-zinc-600 sm:text-[15px]">
            India&apos;s most practical tech programme. No prior experience needed.
          </p>
        </div>
      </section>

      {/* BODY */}
      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-3 sm:space-y-4 sm:px-6 sm:pt-4">
        {/* STATS GRID */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
          <Stat
            value="220+"
            label="Learners placed"
            bg="#f0fdf4"
            valueColor="#15803d"
            labelColor="#166534"
          />
          <Stat
            value="4.0 LPA"
            label="Avg starting salary"
            bg="#eff6ff"
            valueColor="#1d4ed8"
            labelColor="#1e40af"
          />
          <Stat
            value="X+"
            label="Hiring partners"
            bg="#fef9c3"
            valueColor="#b45309"
            labelColor="#92400e"
          />
          <Stat
            value="Y+"
            label="Placement rate"
            bg="#fce7f3"
            valueColor="#9d174d"
            labelColor="#831843"
          />
        </div>

        {/* WHAT YOU GET + VIDEO */}
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-[18px] sm:p-6">
            <div className="mb-2.5 text-[15px] font-extrabold text-zinc-900 sm:text-[16px]">
              What you get
            </div>
            <div className="flex flex-col gap-2.5">
              <Bullet Icon={IconBriefcase}>Real job skills, not just theory</Bullet>
              <Bullet Icon={IconUsers}>1:1 mentorship and live projects</Bullet>
              <Bullet Icon={IconBuildingSkyscraper}>Direct placement support</Bullet>
              <Bullet Icon={IconDeviceMobile}>Learn at your own pace</Bullet>
            </div>
          </div>

          <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-[18px] sm:p-6">
            <div className="mb-2.5 text-[15px] font-extrabold text-zinc-900 sm:text-[16px]">
              Watch and learn more
            </div>
            <div
              className="relative w-full overflow-hidden rounded-xl bg-zinc-100"
              style={{ paddingBottom: '56.25%' }}
            >
              <iframe
                src="https://www.youtube.com/embed/prPfMC8nLoY"
                title="HyperVerge Academy — about the programme"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>
        </div>

        {/* AMBER CALLOUT */}
        <div className="rounded-2xl border-[0.5px] border-[#fde68a] bg-[#fffbeb] p-3.5 sm:p-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-extrabold text-[#92400e] sm:text-[13px]">
            <IconTarget size={16} stroke={2} />
            Admission is selection-based
          </div>
          <p className="text-[13px] leading-[1.55] text-[#78350f] sm:text-[14px]">
            We review each candidate carefully. If you are honest and consistent, you have a great chance.
          </p>
        </div>

        {/* JOURNEY */}
        <div className="rounded-[20px] border-[0.5px] border-zinc-200 bg-white p-[18px] sm:p-6">
          <div className="mb-3 text-[15px] font-extrabold text-zinc-900 sm:text-[16px]">
            How the journey works
          </div>
          <div className="space-y-1">
            {STAGES.map(({ name, slug, description }, i) => {
              const isCurrent = i === 0
              return (
                <Link
                  key={slug}
                  href={`/candidate/${slug}`}
                  className="group -mx-2 block rounded-xl px-2 py-2 transition-colors hover:bg-[#f0fdf4]"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-extrabold transition-all ${
                        isCurrent
                          ? 'border-[#15803d] bg-[#16a34a] text-white group-hover:shadow-[0_0_0_3px_rgba(22,163,74,0.2)]'
                          : 'border-zinc-200 bg-zinc-100 text-zinc-400 group-hover:border-[#bbf7d0] group-hover:bg-[#dcfce7] group-hover:text-[#166534]'
                      }`}
                    >
                      {isCurrent ? <IconArrowRight size={12} stroke={3} /> : i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[13px] font-extrabold sm:text-[14px] ${
                            isCurrent ? 'text-[#166534]' : 'text-zinc-700 group-hover:text-[#166534]'
                          }`}
                        >
                          {name}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#166534]">
                            Current
                          </span>
                        )}
                        <IconChevronRight
                          size={16}
                          stroke={2.2}
                          className="ml-auto text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#16a34a]"
                        />
                      </div>
                      <p className="mt-1 text-[12px] leading-[1.55] text-zinc-500 sm:text-[13px]">
                        {description}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/candidate/interest-form"
          className="group mt-4 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#0f1f0f] px-6 py-5 text-[15px] font-extrabold text-white shadow-sm transition-all hover:bg-[#15301a] hover:shadow-md active:scale-[0.99] sm:py-6 sm:text-[16px]"
        >
          Continue
          <IconArrowRight
            size={16}
            stroke={2.5}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </main>
  )
}

function Stat({
  value,
  label,
  bg,
  valueColor,
  labelColor,
}: {
  value: string
  label: string
  bg: string
  valueColor: string
  labelColor: string
}) {
  return (
    <div
      className="rounded-[14px] p-3.5 text-center sm:p-5"
      style={{ backgroundColor: bg }}
    >
      <div
        className="text-[22px] font-black sm:text-[28px]"
        style={{ color: valueColor, fontFamily: 'var(--font-jakarta), sans-serif' }}
      >
        {value}
      </div>
      <div
        className="mt-0.5 text-[11px] font-bold sm:text-[12px]"
        style={{ color: labelColor }}
      >
        {label}
      </div>
    </div>
  )
}

function Bullet({
  Icon,
  children,
}: {
  Icon: TablerIcon
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={18} stroke={2} className="mt-0.5 flex-shrink-0 text-[#16a34a]" />
      <span className="text-[13px] leading-[1.5] text-zinc-900 sm:text-[14px]">
        {children}
      </span>
    </div>
  )
}

