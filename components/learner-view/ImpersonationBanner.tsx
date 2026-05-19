'use client'

import { useTransition } from 'react'
import { exitImpersonation } from '@/app/(protected)/learner-view/actions'

interface Props {
  learnerName: string
}

export default function ImpersonationBanner({ learnerName }: Props) {
  const [isPending, startTrans] = useTransition()

  function handleExit() {
    startTrans(async () => {
      try {
        await exitImpersonation()
      } catch (e) {
        // redirect() throws NEXT_REDIRECT — expected
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('NEXT_REDIRECT')) return
        console.error(msg)
      }
    })
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-amber-900">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 .22.53l2 2a.75.75 0 1 0 1.06-1.06l-1.78-1.78v-3.19Z" clipRule="evenodd" />
        </svg>
        <span>
          Viewing as <span className="font-semibold">{learnerName}</span> · read-only
        </span>
      </div>
      <button
        onClick={handleExit}
        disabled={isPending}
        className="rounded-md bg-amber-900 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-800 disabled:opacity-40"
      >
        {isPending ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  )
}
