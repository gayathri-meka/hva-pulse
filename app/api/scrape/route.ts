import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { scrapeJobsForPersonas } from '@/lib/scraper'
import type { JobPersona } from '@/types'

export const maxDuration = 60

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('email', user.email!)
    .single()
  if (!appUser || appUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfiguration: service role key missing' }, { status: 500 })
  }

  const adminClient = createClient(url, key)

  const { data: personas, error: personasError } = await adminClient
    .from('job_personas')
    .select('*')
    .eq('active', true)

  if (personasError) {
    return NextResponse.json({ error: personasError.message }, { status: 500 })
  }

  const result = await scrapeJobsForPersonas((personas ?? []) as JobPersona[])

  if (result.error && !(result as { candidates?: unknown[] }).candidates) {
    return NextResponse.json({ error: result.error, inserted: 0, skipped: 0, fetched: 0, filteredByTitle: 0 }, { status: 200 })
  }

  const candidates = (result as { candidates?: Array<Record<string, unknown>> }).candidates ?? []
  if (candidates.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skipped: 0,
      fetched: result.fetched ?? 0,
      filteredByTitle: result.filteredByTitle ?? 0,
    })
  }

  let inserted = 0
  let skipped = 0

  for (const candidate of candidates) {
    const { matchScore: _score, ...row } = candidate as { matchScore: number; [key: string]: unknown }
    const { error } = await adminClient
      .from('job_opportunities')
      .upsert(row, {
        onConflict: 'source_platform,external_id',
        ignoreDuplicates: true,
      })

    if (error) {
      skipped++
    } else {
      inserted++
    }
  }

  return NextResponse.json({
    inserted,
    skipped,
    fetched: result.fetched ?? candidates.length,
    filteredByTitle: result.filteredByTitle ?? 0,
  })
}
