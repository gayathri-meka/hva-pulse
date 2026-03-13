'use client'

import { useState, useTransition } from 'react'
import { savePlacementThresholds, type PlacementThresholds } from '@/app/(protected)/placements/analytics/actions'

interface Props {
  thresholds: PlacementThresholds
  isAdmin: boolean
}

export default function ThresholdEditor({ thresholds, isAdmin }: Props) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(thresholds)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  if (!isAdmin) return null

  function handleChange(key: keyof PlacementThresholds, raw: string) {
    const n = parseFloat(raw)
    if (!isNaN(n)) setValues((prev) => ({ ...prev, [key]: n }))
  }

  function handleSave() {
    startTransition(async () => {
      await savePlacementThresholds(values)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    })
  }

  function handleCancel() {
    setValues(thresholds)
    setOpen(false)
  }

  return (
    <div className="flex items-center justify-end">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
        title="Edit scoring benchmarks"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
        </svg>
        Benchmarks
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-10 w-72 rounded-xl border border-zinc-200 bg-white p-4 shadow-lg">
          <p className="mb-3 text-xs font-semibold text-zinc-700">Scoring Benchmarks</p>
          <p className="mb-4 text-[11px] leading-relaxed text-zinc-400">
            Each dimension scores 0–1 against these targets. Adjust as the programme scales.
          </p>

          <div className="space-y-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-600">Demand target <span className="text-zinc-400">(open roles)</span></span>
              <input
                type="number"
                min={1}
                step={1}
                value={values.demand_target}
                onChange={(e) => handleChange('demand_target', e.target.value)}
                className="w-20 rounded-md border border-zinc-200 px-2 py-1 text-right text-sm tabular-nums text-zinc-800 focus:border-zinc-400 focus:outline-none"
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-600">Engagement target <span className="text-zinc-400">(apps / role)</span></span>
              <input
                type="number"
                min={0.1}
                step={0.5}
                value={values.engagement_target}
                onChange={(e) => handleChange('engagement_target', e.target.value)}
                className="w-20 rounded-md border border-zinc-200 px-2 py-1 text-right text-sm tabular-nums text-zinc-800 focus:border-zinc-400 focus:outline-none"
              />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-600">Conversion target <span className="text-zinc-400">(% hired)</span></span>
              <input
                type="number"
                min={1}
                max={100}
                step={5}
                value={Math.round(values.conversion_target * 100)}
                onChange={(e) => handleChange('conversion_target', String(parseFloat(e.target.value) / 100))}
                className="w-20 rounded-md border border-zinc-200 px-2 py-1 text-right text-sm tabular-nums text-zinc-800 focus:border-zinc-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={handleCancel}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-[#5BAE5B] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {saved ? 'Saved!' : isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
