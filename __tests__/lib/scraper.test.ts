import { describe, test, expect, vi, beforeEach } from 'vitest'
import * as cheerio from 'cheerio'

// ── extractJobId ──────────────────────────────────────────────────────────────
import { extractJobId } from '@/lib/scraper'

describe('extractJobId', () => {
  test('extracts numeric ID from plain LinkedIn URL', () => {
    expect(extractJobId('https://www.linkedin.com/jobs/view/4098765123/?position=1')).toBe('4098765123')
  })

  test('extracts numeric ID from slug URL', () => {
    expect(extractJobId('https://www.linkedin.com/jobs/view/react-developer-at-acme-corp-4098765123/')).toBe('4098765123')
  })

  test('extracts numeric ID from Indian subdomain URL', () => {
    expect(extractJobId('https://in.linkedin.com/jobs/view/frontend-engineer-4123456789/?refId=abc')).toBe('4123456789')
  })

  test('falls back to URL path when no long digit sequence', () => {
    const result = extractJobId('https://www.linkedin.com/jobs/view/some-job/')
    expect(result).toBe('https://www.linkedin.com/jobs/view/some-job/')
  })

  test('returns non-null string when link is null', () => {
    const result = extractJobId(null)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('returns non-null string when link is undefined', () => {
    const result = extractJobId(undefined)
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('strips query params from fallback path', () => {
    const result = extractJobId('https://www.linkedin.com/jobs/view/abc?position=1&refId=xyz')
    // No long digits in path, so fallback = path without query string
    expect(result).toBe('https://www.linkedin.com/jobs/view/abc')
  })

  test('always returns a non-null, non-empty string', () => {
    const inputs = [
      null,
      undefined,
      '',
      'https://www.linkedin.com/jobs/view/1234567890/',
      'https://in.linkedin.com/jobs/view/senior-dev-9876543210/',
    ]
    for (const input of inputs) {
      const result = extractJobId(input)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    }
  })
})

// ── LinkedIn HTML parsing (cheerio selectors) ────────────────────────────────
// Verifies that our cheerio selectors correctly parse the LinkedIn jobs-guest
// HTML structure. If LinkedIn changes their HTML, these tests will catch it
// before it causes silent 0-result scrapes.

function makeLinkedInHtml(jobs: { title: string; company: string; location: string; datetime: string; href: string }[]) {
  const items = jobs.map(({ title, company, location, datetime, href }) => `
    <li>
      <div class="base-card">
        <a class="base-card__full-link" href="${href}"></a>
        <div class="base-search-card__info">
          <h3 class="base-search-card__title">${title}</h3>
          <h4 class="base-search-card__subtitle">${company}</h4>
          <div class="base-search-card__metadata">
            <span class="job-search-card__location">${location}</span>
            <time class="job-search-card__listdate" datetime="${datetime}">2 weeks ago</time>
          </div>
        </div>
      </div>
    </li>
  `).join('')
  return `<ul>${items}</ul>`
}

describe('LinkedIn HTML parsing', () => {
  test('parses job title, company, location, date from well-formed HTML', () => {
    const html = makeLinkedInHtml([{
      title:    'Frontend Developer',
      company:  'Acme Corp',
      location: 'Bangalore, Karnataka, India',
      datetime: '2026-02-15',
      href:     'https://www.linkedin.com/jobs/view/4098765123/?position=1',
    }])

    const $    = cheerio.load(html)
    const jobs: { title: string; company: string; location: string; dateStr: string | null; id: string }[] = []

    $('li').each((_, el) => {
      const $el    = $(el)
      const title   = $el.find('.base-search-card__title').text().trim()
      const company = $el.find('.base-search-card__subtitle').text().trim()
      const loc     = $el.find('.job-search-card__location').text().trim()
      const dateStr = $el.find('time').attr('datetime') ?? null
      const link    = $el.find('a.base-card__full-link').attr('href') ?? null
      if (!title || !company) return
      jobs.push({ title, company, location: loc, dateStr, id: extractJobId(link) })
    })

    expect(jobs).toHaveLength(1)
    expect(jobs[0].title).toBe('Frontend Developer')
    expect(jobs[0].company).toBe('Acme Corp')
    expect(jobs[0].location).toBe('Bangalore, Karnataka, India')
    expect(jobs[0].dateStr).toBe('2026-02-15')
    expect(jobs[0].id).toBe('4098765123')
  })

  test('parses multiple jobs from a list', () => {
    const html = makeLinkedInHtml([
      { title: 'React Developer',     company: 'TechCo',   location: 'Hyderabad', datetime: '2026-02-10', href: 'https://www.linkedin.com/jobs/view/1111111111/' },
      { title: 'Frontend Engineer',   company: 'StartupX', location: 'Chennai',   datetime: '2026-02-12', href: 'https://www.linkedin.com/jobs/view/2222222222/' },
      { title: 'UI Developer',        company: 'BigCorp',  location: 'Remote',    datetime: '2026-02-14', href: 'https://www.linkedin.com/jobs/view/3333333333/' },
    ])

    const $ = cheerio.load(html)
    const titles: string[] = []
    $('li').each((_, el) => {
      const t = $(el).find('.base-search-card__title').text().trim()
      if (t) titles.push(t)
    })

    expect(titles).toEqual(['React Developer', 'Frontend Engineer', 'UI Developer'])
  })

  test('skips list items with no title or company', () => {
    const html = `
      <ul>
        <li><div class="base-search-card__title"></div></li>
        <li>
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/9999999999/"></a>
          <div class="base-search-card__title">Valid Job</div>
          <div class="base-search-card__subtitle">Valid Co</div>
        </li>
      </ul>
    `
    const $ = cheerio.load(html)
    const jobs: string[] = []
    $('li').each((_, el) => {
      const title   = $(el).find('.base-search-card__title').text().trim()
      const company = $(el).find('.base-search-card__subtitle').text().trim()
      if (!title || !company) return
      jobs.push(title)
    })
    expect(jobs).toEqual(['Valid Job'])
  })

  test('extractJobId handles slug-format LinkedIn URLs correctly', () => {
    const slugUrl = 'https://www.linkedin.com/jobs/view/react-developer-at-acme-corp-4098765123/?position=1'
    expect(extractJobId(slugUrl)).toBe('4098765123')
  })
})

// ── scrapeJobsForPersonas (integration via mocked fetch) ─────────────────────
import { scrapeJobsForPersonas } from '@/lib/scraper'
import type { JobPersona } from '@/types'

const basePersona: JobPersona = {
  id:                  'persona-1',
  name:                'Frontend',
  target_job_titles:   ['Frontend Developer'],
  required_skills:     ['React', 'JavaScript'],
  experience_min:      null,
  experience_max:      null,
  preferred_locations: ['Bangalore'],
  remote_allowed:      false,
  entry_level_only:    false,
  platforms:           ['linkedin'],
  active:              true,
  created_by:          'user-1',
  created_at:          '2026-01-01T00:00:00Z',
  updated_at:          '2026-01-01T00:00:00Z',
}

function makePageHtml(jobs: { title: string; company: string; id: string }[]) {
  return makeLinkedInHtml(jobs.map((j) => ({
    title:    j.title,
    company:  j.company,
    location: 'Bangalore, India',
    datetime: '2026-02-01',
    href:     `https://www.linkedin.com/jobs/view/${j.id}/`,
  })))
}

describe('scrapeJobsForPersonas', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  test('returns error when no active personas', async () => {
    const result = await scrapeJobsForPersonas([{ ...basePersona, active: false }])
    expect(result.error).toMatch(/no active personas/i)
    expect(result.inserted).toBe(0)
  })

  test('returns candidates for all fetched jobs without filtering', async () => {
    const html = makePageHtml([
      { title: 'React Developer',   company: 'Acme',    id: '1111111111' },
      { title: 'UI Engineer',       company: 'Beta',    id: '2222222222' },
      { title: 'Backend Developer', company: 'Gamma',   id: '3333333333' }, // different domain — still included
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      text: async () => html,
    }))

    const result = (await scrapeJobsForPersonas([basePersona])) as unknown as { candidates: unknown[]; fetched: number }
    // 3 unique jobs after dedup (same 3 jobs returned on both pages)
    expect(result.candidates).toHaveLength(3)
    // fetched = raw count across all pages (2 pages × 3 jobs = 6)
    expect(result.fetched).toBe(6)
  })

  test('deduplicates jobs with the same external_id across pages', async () => {
    const html = makePageHtml([{ title: 'React Developer', company: 'Acme', id: '1111111111' }])
    // Both pages return the same job
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      text: async () => html,
    }))

    const result = (await scrapeJobsForPersonas([basePersona])) as unknown as { candidates: unknown[] }
    // page1 and page2 both return the job, dedup should keep only 1
    expect(result.candidates).toHaveLength(1)
  })

  test('all candidates have non-null external_id', async () => {
    const html = makePageHtml([
      { title: 'React Developer',   company: 'Acme', id: '1111111111' },
      { title: 'Frontend Engineer', company: 'Beta', id: '2222222222' },
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:   true,
      text: async () => html,
    }))

    const result = (await scrapeJobsForPersonas([basePersona])) as unknown as { candidates: { external_id: string | null }[] }
    for (const c of result.candidates) {
      expect(c.external_id).not.toBeNull()
      expect(typeof c.external_id).toBe('string')
    }
  })

  test('source_platform is always linkedin', async () => {
    const html = makePageHtml([{ title: 'React Dev', company: 'Co', id: '5555555555' }])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => html }))

    const result = (await scrapeJobsForPersonas([basePersona])) as unknown as { candidates: { source_platform: string }[] }
    expect(result.candidates.every((c) => c.source_platform === 'linkedin')).toBe(true)
  })

  test('handles LinkedIn returning non-ok response gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => '' }))
    const result = await scrapeJobsForPersonas([basePersona])
    expect(result.error).toBeUndefined()
    expect(result.fetched).toBe(0)
  })

  test('handles fetch throwing (network error) gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await scrapeJobsForPersonas([basePersona])
    expect(result.error).toBeUndefined()
    expect(result.fetched).toBe(0)
  })

  test('adds f_E=2 to URL when entry_level_only is true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '<ul></ul>' })
    vi.stubGlobal('fetch', fetchMock)

    await scrapeJobsForPersonas([{ ...basePersona, entry_level_only: true }])

    const calledUrls: string[] = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(calledUrls.some((u) => u.includes('f_E=2'))).toBe(true)
  })

  test('does not add f_E param when entry_level_only is false', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '<ul></ul>' })
    vi.stubGlobal('fetch', fetchMock)

    await scrapeJobsForPersonas([{ ...basePersona, entry_level_only: false }])

    const calledUrls: string[] = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string)
    expect(calledUrls.every((u) => !u.includes('f_E'))).toBe(true)
  })

  test('includes skills in search keywords sent to LinkedIn', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '<ul></ul>' })
    vi.stubGlobal('fetch', fetchMock)

    await scrapeJobsForPersonas([basePersona])

    const calledUrls: string[] = fetchMock.mock.calls.map((c: unknown[]) => c[0] as string)
    // keywords should contain "React" and "JavaScript" (from required_skills)
    expect(calledUrls.some((u) => u.includes('React') && u.includes('JavaScript'))).toBe(true)
  })
})
