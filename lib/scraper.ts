import type { JobPersona } from '@/types'

export type JoobleJob = {
  title: string
  company: string
  location: string
  snippet: string
  salary: string
  source: string
  type: string
  link: string
  updated: string
  id: string
}

export type ScrapeResult = {
  job_title: string
  company_name: string
  location: string | null
  source_platform: string
  date_posted: string | null
  job_description: string | null
  match_reasoning: string
  original_url: string | null
  external_id: string | null
  persona_id: string
  status: 'discovered'
}

export type ScrapeOutcome = {
  inserted: number
  skipped: number
  error?: string
}

async function fetchJoobleJobs(
  keywords: string,
  location: string,
  apiKey: string
): Promise<JoobleJob[]> {
  const res = await fetch(`https://jooble.org/api/${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords, location, resultonpage: 20 }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data?.jobs ?? []) as JoobleJob[]
}

function countTitleMatches(title: string, targetTitles: string[]): { count: number; matched: string[] } {
  const lower = title.toLowerCase()
  const matched = targetTitles.filter((t) => lower.includes(t.toLowerCase()))
  return { count: matched.length, matched }
}

function countSkillMatches(description: string, skills: string[]): { count: number; matched: string[] } {
  const lower = description.toLowerCase()
  const matched = skills.filter((s) => lower.includes(s.toLowerCase()))
  return { count: matched.length, matched }
}

function checkExperienceMatch(description: string, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true
  const matches = description.match(/(\d+)\s*(?:\+\s*)?years?/gi)
  if (!matches) return true // can't determine, pass through
  for (const m of matches) {
    const num = parseInt(m.replace(/\D+/g, ''), 10)
    if (!isNaN(num)) {
      if (min !== null && num < min) return false
      if (max !== null && num > max) return false
      return true
    }
  }
  return true
}

function buildMatchReasoning(
  titleMatched: string[],
  skillsMatched: string[],
  location: string
): string {
  const parts: string[] = []
  if (titleMatched.length > 0) {
    parts.push(`Title matched: ${titleMatched.slice(0, 3).join(', ')}`)
  }
  if (skillsMatched.length > 0) {
    parts.push(`Skills found: ${skillsMatched.slice(0, 5).join(', ')}`)
  }
  if (location) {
    parts.push(`Location: ${location}`)
  }
  return parts.join('. ') || 'Generic match'
}

function parseDate(dateStr: string): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch {
    return null
  }
}

export async function scrapeJobsForPersonas(personas: JobPersona[]): Promise<ScrapeOutcome> {
  const apiKey = process.env.JOOBLE_API_KEY?.trim()
  if (!apiKey) {
    return {
      inserted: 0,
      skipped: 0,
      error: 'JOOBLE_API_KEY is not set. Add it to your environment variables to enable scraping.',
    }
  }

  const activePersonas = personas.filter((p) => p.active)
  if (activePersonas.length === 0) {
    return { inserted: 0, skipped: 0, error: 'No active personas found.' }
  }

  // Collect all jobs with their best-matching persona
  type CandidateJob = ScrapeResult & { matchScore: number }
  const candidates: CandidateJob[] = []

  for (const persona of activePersonas) {
    const keywords = persona.target_job_titles.join(' ')
    const locations = persona.preferred_locations.length > 0 ? persona.preferred_locations : ['']

    for (const location of locations) {
      let jobs: JoobleJob[] = []
      try {
        jobs = await fetchJoobleJobs(keywords, location, apiKey)
      } catch {
        // silently skip failed API calls
        continue
      }

      for (const job of jobs) {
        const description = job.snippet ?? ''
        const title = job.title ?? ''

        const { count: titleCount, matched: titleMatched } = countTitleMatches(
          title,
          persona.target_job_titles
        )
        if (titleCount === 0) continue

        const { count: skillCount, matched: skillsMatched } = countSkillMatches(
          description,
          persona.required_skills
        )
        if (skillCount === 0 && persona.required_skills.length > 0) continue

        const expOk = checkExperienceMatch(description, persona.experience_min, persona.experience_max)
        if (!expOk) continue

        const matchScore = titleCount * 2 + skillCount
        const matchReasoning = buildMatchReasoning(titleMatched, skillsMatched, job.location ?? location)

        candidates.push({
          job_title: title,
          company_name: job.company ?? 'Unknown',
          location: job.location || location || null,
          source_platform: 'jooble',
          date_posted: parseDate(job.updated),
          job_description: description || null,
          match_reasoning: matchReasoning,
          original_url: job.link || null,
          external_id: job.id || null,
          persona_id: persona.id,
          status: 'discovered',
          matchScore,
        })
      }
    }
  }

  return { inserted: candidates.length, skipped: 0, candidates } as ScrapeOutcome & { candidates: CandidateJob[] }
}
