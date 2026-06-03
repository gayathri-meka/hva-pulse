import ComingSoonPanel from '@/components/candidate/ComingSoonPanel'

export const dynamic = 'force-dynamic'

export default function ChallengePage() {
  return (
    <ComingSoonPanel
      stage="Challenge"
      description="Complete this 14-day challenge to show you have what it takes."
    />
  )
}
