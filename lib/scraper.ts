import * as cheerio from 'cheerio'
import type { JobPersona } from '@/types'

export type ScrapeResult = {
  job_title:       string
  company_name:    string
  location:        string | null
  source_platform: string
  date_posted:     string | null
  job_description: string | null
  match_reasoning: string
  original_url:    string | null
  external_id:     string | null
  persona_id:      string
  status:          'discovered'
}

export type ScrapeOutcome = {
  inserted:         number
  skipped:          number
  fetched?:         number
  filteredByTitle?: number
  error?:           string
}

type LinkedInJob = {
  title:   string
  company: string
  location: string
  dateStr: string | null
  link:    string | null
  id:      string | null
}

// ── LinkedIn scraper ──────────────────────────────────────────────────────────
// Uses the public jobs-guest API endpoint — no login required.
async function fetchLinkedInJobs(keywords: string, location: string): Promise<LinkedInJob[]> {
  const params = new URLSearchParams({
    keywords,
    f_TPR: 'r2592000', // last 30 days
    start:  '0',
  })
  if (location) params.set('location', location)

  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer':         'https://www.linkedin.com/',
      },
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    console.error(`LinkedIn fetch error for "${keywords}" in "${location}":`, e)
    return []
  }

  if (!res.ok) {
    console.error(`LinkedIn returned ${res.status} for "${keywords}" in "${location}"`)
    return []
  }

  const html = await res.text()
  const $    = cheerio.load(html)
  const jobs: LinkedInJob[] = []

  $('li').each((_, el) => {
    const $el    = $(el)
    const title   = $el.find('.base-search-card__title').text().trim()
    const company = $el.find('.base-search-card__subtitle').text().trim()
    const loc     = $el.find('.job-search-card__location').text().trim()
    const dateStr = $el.find('time').attr('datetime') ?? null
    const link    = $el.find('a.base-card__full-link').attr('href') ?? null

    if (!title || !company) return

    const idMatch = link?.match(/\/jobs\/view\/(\d+)/)
    const id      = idMatch?.[1] ?? null

    jobs.push({ title, company, location: loc, dateStr, link: link ?? null, id })
  })

  return jobs
}

// ── Filtering helpers ─────────────────────────────────────────────────────────
function countTitleMatches(title: string, targetTitles: string[]): { count: number; matched: string[] } {
  const lower   = title.toLowerCase()
  const matched = targetTitles.filter((t) => {
    const tl = t.toLowerCase()
    if (lower.includes(tl)) return true
    return tl.split(/\s+/).some((word) => word.length >= 4 && lower.includes(word))
  })
  return { count: matched.length, matched }
}

function countSkillMatches(text: string, skills: string[]): { count: number; matched: string[] } {
  const lower   = text.toLowerCase()
  const matched = skills.filter((s) => lower.includes(s.toLowerCase()))
  return { count: matched.length, matched }
}

function checkExperienceMatch(text: string, min: number | null, max: number | null): boolean {
  if (min === null && max === null) return true
  const hits = text.match(/(\d+)\s*(?:\+\s*)?years?/gi)
  if (!hits) return true
  for (const m of hits) {
    const n = parseInt(m.replace(/\D+/g, ''), 10)
    if (!isNaN(n)) {
      if (min !== null && n < min) return false
      if (max !== null && n > max) return false
      return true
    }
  }
  return true
}

function buildMatchReasoning(titleMatched: string[], skillsMatched: string[], location: string): string {
  const parts: string[] = []
  if (titleMatched.length > 0)  parts.push(`Title matched: ${titleMatched.slice(0, 3).join(', ')}`)
  if (skillsMatched.length > 0) parts.push(`Skills found: ${skillsMatched.slice(0, 5).join(', ')}`)
  if (location)                  parts.push(`Location: ${location}`)
  return parts.join('. ') || 'Generic match'
}

function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch {
    return null
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeJobsForPersonas(personas: JobPersona[]): Promise<ScrapeOutcome> {
  const activePersonas = personas.filter((p) => p.active)
  if (activePersonas.length === 0) {
    return { inserted: 0, skipped: 0, error: 'No active personas found.' }
  }

  type CandidateJob = ScrapeResult & { matchScore: number }
  const candidates: CandidateJob[] = []
  const seenIds = new Set<string>()
  let totalFetched   = 0
  let filteredByTitle = 0

  for (const persona of activePersonas) {
    // Search once per title × location combo for better precision
    const locations = persona.preferred_locations.length > 0 ? persona.preferred_locations : ['']

    for (const title of persona.target_job_titles) {
      for (const location of locations) {
        let jobs: LinkedInJob[] = []
        try {
          jobs = await fetchLinkedInJobs(title, location)
        } catch {
          continue
        }

        totalFetched += jobs.length

        for (const job of jobs) {
          // Deduplicate within this scrape run
          const dedupeKey = `linkedin:${job.id ?? job.title + job.company}`
          if (seenIds.has(dedupeKey)) continue
          seenIds.add(dedupeKey)

          // Title must match at least one of the persona's target titles
          const { count: titleCount, matched: titleMatched } = countTitleMatches(
            job.title, persona.target_job_titles
          )
          if (titleCount === 0) { filteredByTitle++; continue }

          // Skills soft match (against title since we have no description from search results)
          const { matched: skillsMatched } = countSkillMatches(job.title, persona.required_skills)

          // Experience: best-effort from title text only
          const expOk = checkExperienceMatch(job.title, persona.experience_min, persona.experience_max)
          if (!expOk) continue

          const matchScore     = titleCount * 2 + skillsMatched.length
          const matchReasoning = buildMatchReasoning(titleMatched, skillsMatched, job.location ?? location)

          candidates.push({
            job_title:       job.title,
            company_name:    job.company || 'Unknown',
            location:        job.location || location || null,
            source_platform: 'linkedin',
            date_posted:     parseDate(job.dateStr),
            job_description: null, // full description requires a separate page fetch
            match_reasoning: matchReasoning,
            original_url:    job.link,
            external_id:     job.id,
            persona_id:      persona.id,
            status:          'discovered',
            matchScore,
          })
        }
      }
    }
  }

  return {
    inserted: candidates.length,
    skipped:  0,
    fetched:  totalFetched,
    filteredByTitle,
    candidates,
  } as ScrapeOutcome & { candidates: CandidateJob[] }
}
