import ComingSoonPanel from '@/components/candidate/ComingSoonPanel'

export const dynamic = 'force-dynamic'

export default function SelectionPage() {
  return (
    <ComingSoonPanel
      stage="Selection"
      description="Find out the status of your admission to HVA."
    />
  )
}
