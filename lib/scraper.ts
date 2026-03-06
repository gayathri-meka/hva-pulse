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
  title:    string
  company:  string
  location: string
  dateStr:  string | null
  link:     string | null
  id:       string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Extract a unique identifier from a LinkedIn job URL.
// LinkedIn job IDs are 8–10 digit numbers that appear at the end of the view path,
// either as a bare number (/jobs/view/4098765123/) or embedded in a slug
// (/jobs/view/react-developer-at-acme-4098765123/).
// Falls back to the URL path (no query string) so external_id is never null
// — avoiding the DB UNIQUE NULLS NOT DISTINCT constraint issue.
export function extractJobId(link: string | null | undefined): string {
  if (!link) return `unknown:${Date.now()}:${Math.random()}`
  // All digit sequences of 8+ chars — LinkedIn job IDs are always in this range
  const nums = link.match(/\d{8,}/g)
  if (nums?.length) return nums[nums.length - 1] // last long number = job ID
  // Fallback: path without query string
  return link.split('?')[0]
}

// ── LinkedIn scraper ──────────────────────────────────────────────────────────
// Uses the public jobs-guest API endpoint — no login required.
// f_E=2 = Entry level filter; omit for all experience levels.
async function fetchLinkedInPage(
  keywords: string,
  location: string,
  start: number,
  entryLevel: boolean,
): Promise<LinkedInJob[]> {
  const params = new URLSearchParams({
    keywords,
    f_TPR: 'r2592000', // last 30 days
    start:  String(start),
  })
  if (location)   params.set('location', location)
  if (entryLevel) params.set('f_E', '2')

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
    console.error(`LinkedIn fetch error (start=${start}) for "${keywords}" in "${location}":`, e)
    return []
  }

  if (!res.ok) {
    console.error(`LinkedIn returned ${res.status} (start=${start}) for "${keywords}" in "${location}"`)
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

    // Extract LinkedIn job ID — handles both plain (/view/1234567890/)
    // and slug (/view/react-developer-at-acme-1234567890/) URL formats.
    // Always produce a non-null id to avoid the DB UNIQUE NULLS NOT DISTINCT issue.
    const id = extractJobId(link)

    jobs.push({ title, company, location: loc, dateStr, link: link ?? null, id })
  })

  return jobs
}

async function fetchLinkedInJobs(
  keywords: string,
  location: string,
  entryLevel: boolean,
): Promise<LinkedInJob[]> {
  // Fetch 2 pages (≈50 results) per search
  const [page1, page2] = await Promise.all([
    fetchLinkedInPage(keywords, location, 0,  entryLevel),
    fetchLinkedInPage(keywords, location, 25, entryLevel),
  ])
  return [...page1, ...page2]
}

// ── Filtering + scoring helpers ───────────────────────────────────────────────
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

function buildMatchReasoning(titleMatched: string[], skillsMatched: string[], location: string): string {
  const parts: string[] = []
  if (titleMatched.length > 0)  parts.push(`Title matched: ${titleMatched.slice(0, 3).join(', ')}`)
  if (skillsMatched.length > 0) parts.push(`Skills found: ${skillsMatched.slice(0, 5).join(', ')}`)
  if (location)                  parts.push(`Location: ${location}`)
  return parts.join('. ') || 'LinkedIn search match'
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
  let totalFetched = 0

  for (const persona of activePersonas) {
    const locations = persona.preferred_locations.length > 0 ? persona.preferred_locations : ['']

    for (const title of persona.target_job_titles) {
      // Include top skills in the query so LinkedIn does the semantic matching
      const keywords = [title, ...persona.required_skills.slice(0, 3)].join(' ')

      for (const location of locations) {
        let jobs: LinkedInJob[] = []
        try {
          jobs = await fetchLinkedInJobs(keywords, location, persona.entry_level_only ?? false)
        } catch {
          continue
        }

        totalFetched += jobs.length

        for (const job of jobs) {
          // Deduplicate within this scrape run
          const dedupeKey = `linkedin:${job.id ?? `${job.title}|${job.company}`}`
          if (seenIds.has(dedupeKey)) continue
          seenIds.add(dedupeKey)

          // No hard filtering — skills are already in the search keywords so
          // LinkedIn handles relevance. Soft-match title/skills for reasoning only.
          const { matched: titleMatched } = countTitleMatches(job.title, persona.target_job_titles)
          const { matched: skillsMatched } = countSkillMatches(job.title, persona.required_skills)
          const matchScore = titleMatched.length * 2 + skillsMatched.length

          candidates.push({
            job_title:       job.title,
            company_name:    job.company || 'Unknown',
            location:        job.location || location || null,
            source_platform: 'linkedin',
            date_posted:     parseDate(job.dateStr),
            job_description: null,
            match_reasoning: buildMatchReasoning(titleMatched, skillsMatched, job.location ?? location),
            original_url:    job.link,
            external_id:     job.id, // always non-null (set by extractJobId in fetchLinkedInPage)
            persona_id:      persona.id,
            status:          'discovered',
            matchScore,
          })
        }
      }
    }
  }

  return {
    inserted:        candidates.length,
    skipped:         0,
    fetched:         totalFetched,
    filteredByTitle: 0,
    candidates,
  } as ScrapeOutcome & { candidates: CandidateJob[] }
}
