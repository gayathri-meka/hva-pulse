import Link from 'next/link'
import { getCockpit } from '../../cockpit-actions'
import Cockpit from './Cockpit'

export const dynamic = 'force-dynamic'

export default async function ConductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await getCockpit(id)

  if (!res.ok) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm text-zinc-500">{res.error}</p>
        <Link href="/admissions/interviews/notes" className="mt-3 inline-block text-sm font-medium text-[#5BAE5B] hover:underline">
          ← Back to interview notes
        </Link>
      </div>
    )
  }

  return <Cockpit data={res.data} />
}
