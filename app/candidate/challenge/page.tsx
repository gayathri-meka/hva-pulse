import {
  IconAlertCircle,
  IconBolt,
  IconCircleCheck,
  IconExternalLink,
  IconEye,
  IconLock,
  IconPlayerPlay,
  IconTrophy,
} from '@tabler/icons-react'

export const dynamic = 'force-dynamic'

type DayStatus = 'done' | 'missed' | 'today' | 'locked'

type ChallengeDay = {
  day:    number
  title:  string
  status: DayStatus
}

// Placeholder data — TODO: wire to SensAI weekly_coding_task / task_completions
// once the sync is in place. See CLAUDE.md "sensai" section for the recipe.
const DAYS: ChallengeDay[] = [
  { day: 1,  title: 'Intro to HTML',     status: 'done'   },
  { day: 2,  title: 'CSS basics',        status: 'done'   },
  { day: 3,  title: 'JavaScript 101',    status: 'done'   },
  { day: 4,  title: 'Functions & logic', status: 'done'   },
  { day: 5,  title: 'DOM manipulation',  status: 'done'   },
  { day: 6,  title: 'Forms & events',    status: 'done'   },
  { day: 7,  title: 'Mini project 1',    status: 'done'   },
  { day: 8,  title: 'APIs & fetch',      status: 'missed' },
  { day: 9,  title: 'Async JS',          status: 'done'   },
  { day: 10, title: 'React basics',      status: 'today'  },
  { day: 11, title: 'State & props',     status: 'locked' },
  { day: 12, title: 'Routing',           status: 'locked' },
  { day: 13, title: 'Mini project 2',    status: 'locked' },
  { day: 14, title: 'Final challenge',   status: 'locked' },
]

export default function ChallengePage() {
  const completed = DAYS.filter((d) => d.status === 'done').length
  const total = DAYS.length
  const percent = Math.round((completed / total) * 100)

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
          <h1
            className="text-[22px] font-black text-zinc-900"
            style={{
              fontFamily: 'var(--font-jakarta), sans-serif',
              lineHeight: 1.25,
            }}
          >
            14-Day Challenge
          </h1>
        </div>
      </section>

      {/* BODY */}
      <div className="mx-auto max-w-3xl space-y-3 px-4 pt-3 sm:space-y-4 sm:px-6 sm:pt-4">
        {/* PROGRESS CARD */}
        <div className="rounded-2xl border-[0.5px] border-[#fde68a] bg-[#fffbeb] p-4 sm:p-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wide text-[#92400e]">
                Progress
              </div>
              <div
                className="text-[22px] font-black text-[#78350f] sm:text-[26px]"
                style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
              >
                {completed} / {total} days
              </div>
            </div>
            <div className="flex flex-col items-center">
              <IconTrophy size={30} stroke={2} className="text-[#d97706]" />
              <div className="mt-0.5 text-[11px] font-bold text-[#92400e]">
                {percent}% done
              </div>
            </div>
          </div>
          <div
            className="w-full overflow-hidden rounded-full"
            style={{ height: '12px', backgroundColor: '#fde68a' }}
          >
            <div
              className="rounded-full transition-all"
              style={{
                width: `${percent}%`,
                height: '100%',
                backgroundColor: '#f59e0b',
              }}
            />
          </div>
        </div>

        {/* WHAT WE OBSERVE */}
        <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-4 sm:p-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-extrabold text-zinc-900 sm:text-[14px]">
            <IconEye size={16} stroke={2} className="text-[#16a34a]" />
            What we observe
          </div>
          <p className="text-[13px] leading-[1.55] text-zinc-600 sm:text-[14px]">
            Consistency · Effort · Honesty · Comprehension · Problem-solving. You
            don&apos;t need to be perfect, just show up and show your learning
            behaviour.
          </p>
        </div>

        {/* WHERE YOU'LL DO THIS */}
        <div className="rounded-2xl border-[0.5px] border-zinc-200 bg-white p-4 sm:p-5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-extrabold text-zinc-900 sm:text-[14px]">
            <IconBolt size={16} stroke={2} className="text-[#16a34a]" />
            Where you&apos;ll do this
          </div>
          <p className="text-[13px] leading-[1.55] text-zinc-600 sm:text-[14px]">
            Your daily tasks live on{' '}
            <span className="font-extrabold text-zinc-900">SensAI</span>, our
            learning platform. Open today&apos;s task below to head over and start
            working on it.
          </p>
        </div>

        {/* DAYS LIST */}
        <div className="space-y-2 pt-1">
          {DAYS.map((d) => (
            <DayRow key={d.day} {...d} />
          ))}
        </div>
      </div>
    </main>
  )
}

// Colors lifted from the original mockup so they exactly match what the user
// approved. Inline styles instead of Tailwind classes so arbitrary-value JIT
// purging can't accidentally drop them.
const STATUS = {
  done: {
    Icon:        IconCircleCheck,
    iconColor:   '#16a34a',
    iconBg:      '#dcfce7',
    rowBg:       '#f0fdf4',
    borderColor: '#bbf7d0',
    pillBg:      '#dcfce7',
    pillColor:   '#166534',
    pillLabel:   'Done',
  },
  missed: {
    Icon:        IconAlertCircle,
    iconColor:   '#ea580c',
    iconBg:      '#fed7aa',
    rowBg:       '#fff7ed',
    borderColor: '#fed7aa',
    pillBg:      'transparent',
    pillColor:   '#9a3412',
    pillBorder:  '#fdba74',
    pillLabel:   'Missed',
  },
  today: {
    Icon:        IconPlayerPlay,
    iconColor:   '#2563eb',
    iconBg:      '#dbeafe',
    rowBg:       '#eff6ff',
    borderColor: '#bfdbfe',
    pillBg:      '#dbeafe',
    pillColor:   '#1e40af',
    pillLabel:   'Today',
  },
  locked: {
    Icon:        IconLock,
    iconColor:   '#9ca3af',
    iconBg:      '#f3f4f6',
    rowBg:       '#ffffff',
    borderColor: '#e5e7eb',
    pillBg:      '#f3f4f6',
    pillColor:   '#9ca3af',
    pillLabel:   '—',
  },
} as const

function DayRow({ day, title, status }: ChallengeDay) {
  const c = STATUS[status]
  const Icon = c.Icon

  return (
    <div
      className="flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{
        backgroundColor: c.rowBg,
        borderColor: c.borderColor,
        opacity: status === 'locked' ? 0.7 : 1,
      }}
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: c.iconBg }}
      >
        <Icon size={status === 'locked' ? 16 : 18} stroke={2} style={{ color: c.iconColor }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="text-[14px] font-extrabold"
            style={{ color: status === 'locked' ? '#9ca3af' : '#18181b' }}
          >
            Day {day}: {title}
          </span>
          <span
            className="inline-flex flex-shrink-0 items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
            style={{
              backgroundColor: c.pillBg,
              color: c.pillColor,
              ...('pillBorder' in c
                ? { boxShadow: `inset 0 0 0 1px ${c.pillBorder}` }
                : {}),
            }}
          >
            {c.pillLabel}
          </span>
        </div>
        {status === 'missed' && (
          <div
            className="mt-0.5 text-[11px] font-semibold"
            style={{ color: '#ea580c' }}
          >
            Late submission may still be possible
          </div>
        )}
        {status === 'today' && (
          <div className="mt-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-extrabold text-white transition-opacity hover:opacity-90 active:scale-[0.99]"
              style={{ backgroundColor: '#2563eb' }}
            >
              <IconExternalLink size={12} stroke={2.5} />
              Open SensAI
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
