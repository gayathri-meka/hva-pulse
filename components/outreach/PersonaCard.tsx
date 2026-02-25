'use client'

import { useTransition, useState } from 'react'
import type { JobPersona } from '@/types'
import { togglePersonaActive, deletePersona } from '@/app/(protected)/outreach/personas/actions'
import PersonaFormModal from './PersonaFormModal'

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
      {children}
    </span>
  )
}

export default function PersonaCard({ persona }: { persona: JobPersona }) {
  const [isPending, startTransition] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleToggle() {
    startTransition(() => togglePersonaActive(persona.id, !persona.active))
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    startTransition(() => deletePersona(persona.id))
  }

  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${!persona.active ? 'opacity-60' : ''}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="font-semibold text-zinc-900">{persona.name}</h3>
        <div className="flex shrink-0 items-center gap-1">
          <PersonaFormModal persona={persona} />
          <button
            onClick={handleToggle}
            disabled={isPending}
            title={persona.active ? 'Deactivate' : 'Activate'}
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
          >
            {persona.active ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-emerald-600">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className={`rounded p-1 transition-colors disabled:opacity-50 ${
              confirmDelete
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'text-zinc-400 hover:bg-zinc-100 hover:text-red-600'
            }`}
            title={confirmDelete ? 'Confirm delete' : 'Delete persona'}
            onBlur={() => setConfirmDelete(false)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-2 text-xs text-zinc-500">
        {persona.target_job_titles.length > 0 && (
          <div>
            <span className="font-medium text-zinc-700">Titles: </span>
            {persona.target_job_titles.join(', ')}
          </div>
        )}
        {persona.required_skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {persona.required_skills.slice(0, 6).map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
            {persona.required_skills.length > 6 && (
              <Badge>+{persona.required_skills.length - 6}</Badge>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {persona.preferred_locations.length > 0 && (
            <span>📍 {persona.preferred_locations.join(', ')}</span>
          )}
          {persona.remote_allowed && <span>🌐 Remote OK</span>}
          {(persona.experience_min !== null || persona.experience_max !== null) && (
            <span>
              {persona.experience_min !== null ? persona.experience_min : 0}–
              {persona.experience_max !== null ? persona.experience_max : '∞'} yrs
            </span>
          )}
        </div>
        {persona.platforms.length > 0 && (
          <div className="text-zinc-400">Platforms: {persona.platforms.join(', ')}</div>
        )}
      </div>
    </div>
  )
}
