import type { ChallengeStatus } from '@/lib/challengeFunnel'

const TONE: Record<ChallengeStatus, string> = {
  Completed:    'bg-emerald-50 text-emerald-700',
  Started:      'bg-amber-50 text-amber-700',
  Joined:       'bg-blue-50 text-blue-700',
  'Not joined': 'bg-zinc-100 text-zinc-500',
}

const DOT: Record<ChallengeStatus, string> = {
  Completed:    'bg-emerald-500',
  Started:      'bg-amber-500',
  Joined:       'bg-blue-500',
  'Not joined': 'bg-zinc-400',
}

export default function ChallengeStatusBadge({ status }: { status: ChallengeStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${TONE[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {status}
    </span>
  )
}
