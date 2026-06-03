import ComingSoonPanel from '@/components/candidate/ComingSoonPanel'

export const dynamic = 'force-dynamic'

export default function InterviewPage() {
  return (
    <ComingSoonPanel
      stage="Interview"
      description="This is where we get to know you better before making a final decision on your admission."
    />
  )
}
