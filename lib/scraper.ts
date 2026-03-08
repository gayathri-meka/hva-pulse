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
  inserted:  number
  skipped:   number
  fetched?:  number
  error?:    string
}

// Common shape returned by every platform scraper
type ScrapedJob = {
  title:       string
  company:     string
  location:    string
  dateStr:     string | null
  link:        string | null
  id:          string       // never null — each scraper guarantees this
  platform:    string
  description: string | null
}

// ── extractJobId ──────────────────────────────────────────────────────────────
// Exported for testing. Handles plain (/view/1234567890/) and slug URLs
// (/view/react-dev-at-acme-1234567890/). Falls back to URL path so it's
// never null — avoids the DB UNIQUE NULLS NOT DISTINCT constraint issue.
export function extractJobId(link: string | null | undefined): string {
  if (!link) return `unknown:${Date.now()}:${Math.random()}`
  const nums = link.match(/\d{8,}/g)
  if (nums?.length) return nums[nums.length - 1]
  return link.split('?')[0]
}

// ── Location relevance ────────────────────────────────────────────────────────
// Filters out jobs from clearly wrong geographies (e.g. Bulgaria when searching
// for Bangalore). Passes through if location is unknown or no preference is set.
export function isLocationRelevant(jobLoc: string | null | undefined, preferred: string[]): boolean {
  if (!jobLoc || preferred.length === 0) return true
  const loc = jobLoc.toLowerCase()
  return preferred.some((p) => {
    const pl = p.toLowerCase()
    if (pl === 'remote') return loc.includes('remote') || loc.includes('work from home') || loc.includes('wfh')
    return loc.includes(pl)
  })
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function countTitleMatches(title: string, targetTitles: string[]): { matched: string[] } {
  const lower   = title.toLowerCase()
  const matched = targetTitles.filter((t) => {
    const tl = t.toLowerCase()
    if (lower.includes(tl)) return true
    return tl.split(/\s+/).some((w) => w.length >= 4 && lower.includes(w))
  })
  return { matched }
}

function countSkillMatches(text: string, skills: string[]): { matched: string[] } {
  const lower   = text.toLowerCase()
  const matched = skills.filter((s) => lower.includes(s.toLowerCase()))
  return { matched }
}

function buildMatchReasoning(titleMatched: string[], skillsMatched: string[], location: string): string {
  const parts: string[] = []
  if (titleMatched.length > 0)  parts.push(`Title matched: ${titleMatched.slice(0, 3).join(', ')}`)
  if (skillsMatched.length > 0) parts.push(`Skills found: ${skillsMatched.slice(0, 5).join(', ')}`)
  if (location)                  parts.push(`Location: ${location}`)
  return parts.join('. ') || 'Search match'
}

function parseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split('T')[0]
  } catch { return null }
}

async function safeFetch(url: string, headers: Record<string, string> = {}, timeoutMs = 15_000): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) { console.error(`Scrape ${res.status}: ${url}`); return null }
    return res
  } catch (e) {
    console.error(`Scrape error: ${url}`, e)
    return null
  }
}

// ── LinkedIn ──────────────────────────────────────────────────────────────────
async function fetchLinkedInPage(keywords: string, location: string, start: number, entryLevel: boolean): Promise<ScrapedJob[]> {
  const params = new URLSearchParams({ keywords, f_TPR: 'r2592000', start: String(start) })
  if (location)   params.set('location', location)
  if (entryLevel) params.set('f_E', '2')

  const res = await safeFetch(
    `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params}`,
    {
      'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer':         'https://www.linkedin.com/',
    },
  )
  if (!res) return []

  const $ = cheerio.load(await res.text())
  const jobs: ScrapedJob[] = []

  $('li').each((_, el) => {
    const $el    = $(el)
    const title   = $el.find('.base-search-card__title').text().trim()
    const company = $el.find('.base-search-card__subtitle').text().trim()
    const loc     = $el.find('.job-search-card__location').text().trim()
    const dateStr = $el.find('time').attr('datetime') ?? null
    const link    = $el.find('a.base-card__full-link').attr('href') ?? null
    if (!title || !company) return
    jobs.push({ title, company, location: loc, dateStr, link, id: extractJobId(link), platform: 'linkedin', description: null })
  })
  return jobs
}

async function fetchLinkedInJobs(keywords: string, location: string, entryLevel: boolean): Promise<ScrapedJob[]> {
  const [p1, p2] = await Promise.all([
    fetchLinkedInPage(keywords, location, 0, entryLevel),
    fetchLinkedInPage(keywords, location, 25, entryLevel),
  ])
  return [...p1, ...p2]
}

// ── Internshala ───────────────────────────────────────────────────────────────
async function fetchInternshalaJobs(keywords: string, location: string): Promise<ScrapedJob[]> {
  // keywords → comma-separated slug; location → appended to URL if set
  const kw  = keywords.split(' ').slice(0, 4).join(',')
  const loc  = location ? `-${location.toLowerCase().replace(/\s+/g, '-')}-internship` : ''
  const url  = `https://internshala.com/internships/keywords-${encodeURIComponent(kw)}${loc}/`

  const res = await safeFetch(url, {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept':          'text/html,application/xhtml+xml',
    'Accept-Language': 'en-IN,en;q=0.9',
  })
  if (!res) return []

  const $ = cheerio.load(await res.text())
  const jobs: ScrapedJob[] = []

  // Internshala uses `.individual_internship` containers with id="internship_id_XXXXX"
  $('.individual_internship').each((_, el) => {
    const $el     = $(el)
    const rawId   = $el.attr('id') ?? ''             // "internship_id_12345"
    const numId   = rawId.replace(/\D/g, '') || `is-${Date.now()}-${Math.random()}`
    const title   = ($el.find('.profile, .job-internship-name').first().text()).trim()
    const company = ($el.find('.company_name, .company-name').first().text()).trim()
    const loc     = ($el.find('.location_link, .location-name').first().text()).trim()
    const link    = (() => {
      const href = $el.find('a.view_detail_button, a[href*="/internship/detail/"]').first().attr('href')
      return href ? `https://internshala.com${href.startsWith('/') ? href : '/' + href}` : null
    })()
    if (!title || !company) return
    jobs.push({ title, company, location: loc, dateStr: null, link, id: numId, platform: 'internshala', description: null })
  })
  return jobs
}

// ── Indeed ────────────────────────────────────────────────────────────────────
// Uses Indeed's RSS feed which returns proper XML (no JS rendering required).
async function fetchIndeedJobs(keywords: string, location: string, entryLevel: boolean): Promise<ScrapedJob[]> {
  const params = new URLSearchParams({ q: keywords, l: location, sort: 'date' })
  if (entryLevel) params.set('explvl', 'entry_level')
  const url = `https://in.indeed.com/rss?${params}`

  const res = await safeFetch(url, {
    'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept':          'application/rss+xml,text/xml,*/*',
    'Accept-Language': 'en-IN,en;q=0.9',
  })
  if (!res) return []

  const $ = cheerio.load(await res.text(), { xmlMode: true })
  const jobs: ScrapedJob[] = []

  $('item').each((_, el) => {
    const $el    = $(el)
    const raw    = $el.find('title').text().trim()          // "Job Title - Company Name"
    const link   = $el.find('link').text().trim() || $el.find('guid').text().trim()
    const pubDate = $el.find('pubDate').text().trim() || null

    // Indeed RSS title format: "Job Title - Company Name"
    const dashIdx = raw.lastIndexOf(' - ')
    const title   = dashIdx > 0 ? raw.slice(0, dashIdx).trim() : raw
    const company = dashIdx > 0 ? raw.slice(dashIdx + 3).trim() : 'Unknown'

    // Extract job key from URL for dedup
    const jkMatch = link.match(/jk=([a-f0-9]+)/)
    const id      = jkMatch?.[1] ?? extractJobId(link)

    if (!title) return
    jobs.push({ title, company, location, dateStr: pubDate, link, id, platform: 'indeed', description: null })
  })
  return jobs
}

// ── Naukri ────────────────────────────────────────────────────────────────────
// Uses Naukri's internal search JSON API (no authentication required for basic search).
async function fetchNaukriJobs(keywords: string, location: string): Promise<ScrapedJob[]> {
  const params = new URLSearchParams({
    noOfResults: '20',
    urlType:     'search_by_keyword',
    searchType:  'adv',
    keyword:     keywords,
    location:    location,
    experience:  '0',
    pageNo:      '1',
  })
  const url = `https://www.naukri.com/jobapi/v3/search?${params}`

  const res = await safeFetch(url, {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept':     'application/json',
    'appid':      '109',
    'systemid':   '109',
  })
  if (!res) return []

  try {
    const data = await res.json() as { jobDetails?: unknown[] }
    if (!Array.isArray(data?.jobDetails)) return []

    return (data.jobDetails as Record<string, unknown>[]).map((j) => {
      const loc = (() => {
        const ph = j.placeholders
        if (Array.isArray(ph)) {
          const loc = ph.find((p: Record<string, unknown>) => p.label === 'location')
          return String(loc?.value ?? location)
        }
        return location
      })()
      const rawUrl = String(j.jdURL ?? '')
      const link   = rawUrl ? (rawUrl.startsWith('http') ? rawUrl : `https://www.naukri.com${rawUrl}`) : null
      const id     = String(j.jobId ?? extractJobId(link))
      return {
        title:       String(j.title ?? ''),
        company:     String(j.companyName ?? 'Unknown'),
        location:    loc,
        dateStr:     String(j.createdDate ?? ''),
        link,
        id,
        platform:    'naukri',
        description: String(j.jobDescription ?? '') || null,
      } satisfies ScrapedJob
    }).filter((j) => j.title)
  } catch (e) {
    console.error('Naukri JSON parse error:', e)
    return []
  }
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function scrapeJobsForPersonas(personas: JobPersona[]): Promise<ScrapeOutcome> {
  const activePersonas = personas.filter((p) => p.active)
  if (activePersonas.length === 0) {
    return { inserted: 0, skipped: 0, error: 'No active personas found.' }
  }

  // Build all tasks upfront, then fire them all in parallel
  type Task = { persona: JobPersona; platform: string; keywords: string; location: string }
  const tasks: Task[] = []

  for (const persona of activePersonas) {
    // Use specified platforms, default to linkedin if none set
    const platforms = persona.platforms?.length > 0 ? persona.platforms : ['linkedin']
    const locations = persona.preferred_locations.length > 0 ? persona.preferred_locations : ['']

    for (const title of persona.target_job_titles) {
      const keywords = [title, ...persona.required_skills.slice(0, 3)].join(' ')
      for (const location of locations) {
        for (const platform of platforms) {
          tasks.push({ persona, platform, keywords, location })
        }
      }
    }
  }

  const settled = await Promise.allSettled(
    tasks.map(async ({ persona, platform, keywords, location }) => {
      const entryLevel = persona.entry_level_only ?? false
      let jobs: ScrapedJob[] = []
      if (platform === 'linkedin')    jobs = await fetchLinkedInJobs(keywords, location, entryLevel)
      else if (platform === 'internshala') jobs = await fetchInternshalaJobs(keywords, location)
      else if (platform === 'indeed')      jobs = await fetchIndeedJobs(keywords, location, entryLevel)
      else if (platform === 'naukri')      jobs = await fetchNaukriJobs(keywords, location)
      return { jobs, persona, location }
    })
  )

  type CandidateJob = ScrapeResult & { matchScore: number }
  const candidates: CandidateJob[] = []
  const seenIds = new Set<string>()
  let totalFetched = 0

  for (const result of settled) {
    if (result.status === 'rejected') continue
    const { jobs, persona, location } = result.value

    totalFetched += jobs.length

    for (const job of jobs) {
      const dedupeKey = `${job.platform}:${job.id}`
      if (seenIds.has(dedupeKey)) continue
      seenIds.add(dedupeKey)

      // Drop jobs from wrong geography
      if (!isLocationRelevant(job.location, persona.preferred_locations)) continue

      const { matched: titleMatched } = countTitleMatches(job.title, persona.target_job_titles)
      const { matched: skillsMatched } = countSkillMatches(job.title + ' ' + (job.description ?? ''), persona.required_skills)
      const matchScore = titleMatched.length * 2 + skillsMatched.length

      candidates.push({
        job_title:       job.title,
        company_name:    job.company || 'Unknown',
        location:        job.location || location || null,
        source_platform: job.platform,
        date_posted:     parseDate(job.dateStr),
        job_description: job.description,
        match_reasoning: buildMatchReasoning(titleMatched, skillsMatched, job.location ?? location),
        original_url:    job.link,
        external_id:     job.id,
        persona_id:      persona.id,
        status:          'discovered',
        matchScore,
      })
    }
  }

  return {
    inserted: candidates.length,
    skipped:  0,
    fetched:  totalFetched,
    candidates,
  } as ScrapeOutcome & { candidates: CandidateJob[] }
}
