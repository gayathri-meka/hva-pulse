'use client'

import { useState, useTransition, useRef } from 'react'
import type { JobPersona } from '@/types'
import { createPersona, updatePersona } from '@/app/(protected)/outreach/personas/actions'

const SKILL_SUGGESTIONS = [
  'React', 'Next.js', 'TypeScript', 'JavaScript', 'Python', 'Node.js',
  'SQL', 'MongoDB', 'REST API', 'Git', 'Tailwind CSS', 'Vue.js',
  'Angular', 'Java', 'Spring Boot', 'AWS', 'Docker',
]

const LOCATION_SUGGESTIONS = [
  'Bangalore', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Chennai',
  'Remote', 'Noida', 'Gurgaon',
]

const PLATFORM_OPTIONS = ['linkedin', 'naukri', 'internshala']

type TagInputProps = {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
}

function TagInput({ label, tags, onChange, suggestions = [], placeholder }: TagInputProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function addTag(value: string) {
    const trimmed = value.trim()
    if (!trimmed || tags.includes(trimmed)) return
    onChange([...tags, trimmed])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const remainingSuggestions = suggestions.filter((s) => !tags.includes(s))

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</label>
      <div
        className="flex min-h-[42px] flex-wrap gap-1.5 rounded-md border border-zinc-300 bg-white px-2 py-1.5 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-700"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-zinc-400 hover:text-zinc-700"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => addTag(input)}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
      </div>
      {remainingSuggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {remainingSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type Props = { persona?: JobPersona }

export default function PersonaFormModal({ persona }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(persona?.name ?? '')
  const [titles, setTitles] = useState<string[]>(persona?.target_job_titles ?? [])
  const [skills, setSkills] = useState<string[]>(persona?.required_skills ?? [])
  const [expMin, setExpMin] = useState(persona?.experience_min?.toString() ?? '')
  const [expMax, setExpMax] = useState(persona?.experience_max?.toString() ?? '')
  const [locations, setLocations] = useState<string[]>(persona?.preferred_locations ?? [])
  const [remoteAllowed, setRemoteAllowed] = useState(persona?.remote_allowed ?? false)
  const [platforms, setPlatforms] = useState<string[]>(persona?.platforms ?? [])

  function resetForm() {
    setName(persona?.name ?? '')
    setTitles(persona?.target_job_titles ?? [])
    setSkills(persona?.required_skills ?? [])
    setExpMin(persona?.experience_min?.toString() ?? '')
    setExpMax(persona?.experience_max?.toString() ?? '')
    setLocations(persona?.preferred_locations ?? [])
    setRemoteAllowed(persona?.remote_allowed ?? false)
    setPlatforms(persona?.platforms ?? [])
  }

  function togglePlatform(p: string) {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData()
    formData.set('name', name)
    formData.set('target_job_titles', JSON.stringify(titles))
    formData.set('required_skills', JSON.stringify(skills))
    formData.set('experience_min', expMin)
    formData.set('experience_max', expMax)
    formData.set('preferred_locations', JSON.stringify(locations))
    formData.set('remote_allowed', String(remoteAllowed))
    formData.set('platforms', JSON.stringify(platforms))

    startTransition(async () => {
      if (persona) {
        await updatePersona(persona.id, formData)
      } else {
        await createPersona(formData)
      }
      setOpen(false)
    })
  }

  return (
    <>
      <button
        onClick={() => { resetForm(); setOpen(true) }}
        className={
          persona
            ? 'rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700'
            : 'inline-flex items-center gap-2 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700'
        }
        title={persona ? 'Edit persona' : undefined}
      >
        {persona ? (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Persona
          </>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">
                {persona ? 'Edit Persona' : 'New Job Persona'}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Persona Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Frontend Developer – Entry Level"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              <TagInput
                label="Target Job Titles"
                tags={titles}
                onChange={setTitles}
                placeholder="e.g. Frontend Developer, React Developer…"
              />

              <TagInput
                label="Required Skills"
                tags={skills}
                onChange={setSkills}
                suggestions={SKILL_SUGGESTIONS}
                placeholder="e.g. React, TypeScript…"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">Min Experience (yrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={expMin}
                    onChange={(e) => setExpMin(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">Max Experience (yrs)</label>
                  <input
                    type="number"
                    min={0}
                    value={expMax}
                    onChange={(e) => setExpMax(e.target.value)}
                    placeholder="Leave blank for no limit"
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
              </div>

              <TagInput
                label="Preferred Locations"
                tags={locations}
                onChange={setLocations}
                suggestions={LOCATION_SUGGESTIONS}
                placeholder="e.g. Bangalore, Mumbai…"
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="remote_allowed"
                  checked={remoteAllowed}
                  onChange={(e) => setRemoteAllowed(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                <label htmlFor="remote_allowed" className="text-sm text-zinc-700">Remote allowed</label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-zinc-700">Platforms</label>
                <div className="flex gap-3">
                  {PLATFORM_OPTIONS.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-sm text-zinc-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={platforms.includes(p)}
                        onChange={() => togglePlatform(p)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
                >
                  {isPending ? 'Saving…' : persona ? 'Save Changes' : 'Create Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
