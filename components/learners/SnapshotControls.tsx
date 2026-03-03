'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Combobox from '@/components/ui/Combobox'

interface Props {
  learners: { id: string; name: string }[]
}

export default function SnapshotControls({ learners }: Props) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const selected     = searchParams.get('learner') ?? ''

  const options = learners.map((l) => ({ id: l.id, label: l.name || '(no name)' }))

  function onSelect(id: string) {
    const params = new URLSearchParams()
    params.set('tab', 'snapshot')
    if (id) params.set('learner', id)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <Combobox
      options={options}
      value={selected}
      placeholder="Select a learner…"
      onChange={onSelect}
      className="min-w-[280px]"
    />
  )
}
