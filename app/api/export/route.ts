import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape  = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n')
}

async function exportAlumni(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data, error } = await supabase
    .from('alumni')
    .select('id, name, email, cohort_fy, placed_fy, employment_status, contact_number, alumni_jobs(company, role, starting_salary, salary, placement_month, is_current)')
    .order('name')
  if (error) throw error

  return (data ?? []).map((a) => {
    const job = a.alumni_jobs?.find((j: { is_current: boolean }) => j.is_current) ?? a.alumni_jobs?.[0] ?? null
    return {
      id:                a.id,
      name:              a.name,
      email:             a.email ?? '',
      cohort_fy:         a.cohort_fy ?? '',
      placed_fy:         a.placed_fy ?? '',
      employment_status: a.employment_status ?? '',
      contact_number:    a.contact_number ?? '',
      company:           job?.company          ?? '',
      role:              job?.role              ?? '',
      starting_salary:   job?.starting_salary  ?? '',
      current_salary:    job?.salary            ?? '',
      placement_month:   job?.placement_month   ?? '',
    }
  })
}

async function exportApplications(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const [
    { data: apps,      error: appsErr  },
    { data: users,     error: usersErr },
    { data: roles,     error: rolesErr },
    { data: companies, error: coErr    },
  ] = await Promise.all([
    supabase.from('applications').select('*').order('created_at', { ascending: false }),
    supabase.from('users').select('id, name, email'),
    supabase.from('roles').select('id, role_title, location, salary_range, company_id'),
    supabase.from('companies').select('id, company_name'),
  ])
  if (appsErr)  throw appsErr
  if (usersErr) throw usersErr
  if (rolesErr) throw rolesErr
  if (coErr)    throw coErr

  const userMap    = Object.fromEntries((users    ?? []).map((u) => [u.id, u]))
  const roleMap    = Object.fromEntries((roles    ?? []).map((r) => [r.id, r]))
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.company_name]))

  return (apps ?? []).map((app) => {
    const user    = userMap[app.user_id ?? '']
    const role    = roleMap[app.role_id ?? '']
    const company = role ? companyMap[role.company_id] ?? '' : ''
    return {
      id:                              app.id,
      learner_id:                      app.learner_id ?? '',
      learner_name:                    user?.name  ?? '',
      learner_email:                   user?.email ?? '',
      company,
      role_title:                      role?.role_title  ?? '',
      location:                        role?.location    ?? '',
      salary_range:                    role?.salary_range ?? '',
      status:                          app.status ?? '',
      salary_lpa:                      app.salary_lpa ?? '',
      not_shortlisted_reason:          app.not_shortlisted_reason  ?? '',
      not_shortlisted_reasons:         (app.not_shortlisted_reasons as string[] | null)?.join('; ') ?? '',
      rejection_feedback:              app.rejection_feedback ?? '',
      rejection_reasons:               (app.rejection_reasons as string[] | null)?.join('; ') ?? '',
      applied_at:                      app.created_at ?? '',
      shortlisting_decision_taken_at:  app.shortlisting_decision_taken_at  ?? '',
      interviews_started_at:           app.interviews_started_at ?? '',
      hiring_decision_taken_at:        app.hiring_decision_taken_at ?? '',
    }
  })
}

async function exportCompanies(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data, error } = await supabase
    .from('companies')
    .select('id, company_name, sort_order, created_at')
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as Record<string, unknown>[]
}

async function exportRoles(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data, error } = await supabase
    .from('roles')
    .select('id, role_title, location, salary_range, status, job_description, created_at, companies(company_name)')
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((r) => {
    const company = r.companies as unknown as { company_name: string } | null
    return {
      id:            r.id,
      company_name:  company?.company_name ?? '',
      role_title:    r.role_title,
      location:      r.location,
      salary_range:  r.salary_range ?? '',
      status:        r.status,
      job_description: r.job_description ?? '',
      created_at:    r.created_at,
    }
  })
}

async function exportInterventions(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const [
    { data: ivs,      error: ivsErr   },
    { data: learners, error: lrnErr   },
    { data: users,    error: usersErr },
  ] = await Promise.all([
    supabase.from('interventions').select('*').order('created_at', { ascending: false }),
    supabase.from('learners').select('learner_id, user_id, lf_name, batch_name'),
    supabase.from('users').select('id, name, email'),
  ])
  if (ivsErr)   throw ivsErr
  if (lrnErr)   throw lrnErr
  if (usersErr) throw usersErr

  const userMap    = Object.fromEntries((users    ?? []).map((u) => [u.id, u]))
  const learnerMap = Object.fromEntries((learners ?? []).map((l) => [l.learner_id, l]))

  type ActionItemLike = { description?: string; owner?: string; due_date?: string | null; completed_at?: string | null; completion_notes?: string | null; comments?: unknown[] }

  return (ivs ?? []).map((iv) => {
    const learner = learnerMap[iv.learner_id ?? '']
    const user    = learner ? userMap[learner.user_id ?? ''] : null

    const items = (iv.action_items ?? []) as ActionItemLike[]
    const totalItems     = items.length
    const completedItems = items.filter((it) => !!it.completed_at).length
    const itemSummary    = items.map((it) =>
      `${it.description ?? ''} [${it.owner ?? '-'}, due ${it.due_date ?? '-'}, ${it.completed_at ? 'done' : 'pending'}]`
    ).join('; ')

    const itemCommentsCount = items.reduce((acc, it) => acc + ((it.comments ?? []) as unknown[]).length, 0)
    const whatWrongCommentsCount = ((iv.what_wrong_comments ?? []) as unknown[]).length
    const whyCommentsCount       = ((iv.why_comments        ?? []) as unknown[]).length

    return {
      id:                       iv.id,
      learner_id:               iv.learner_id ?? '',
      learner_name:             user?.name  ?? '',
      learner_email:            user?.email ?? '',
      lf_name:                  learner?.lf_name ?? '',
      batch_name:               learner?.batch_name ?? '',
      status:                   iv.status ?? '',
      outcome:                  iv.outcome ?? '',
      outcome_note:             iv.outcome_note ?? '',
      flagged_items:            ((iv.flagged_items ?? []) as string[]).join('; '),
      what_wrong_notes:         iv.what_wrong_notes ?? '',
      root_cause_categories:    ((iv.root_cause_categories ?? []) as string[]).join('; '),
      root_cause_notes:         iv.root_cause_notes ?? '',
      total_action_items:       totalItems,
      completed_action_items:   completedItems,
      action_items_summary:     itemSummary,
      action_item_comments:     itemCommentsCount,
      what_wrong_comments:      whatWrongCommentsCount,
      why_comments:             whyCommentsCount,
      created_at:               iv.created_at ?? '',
      step1_completed_at:       iv.step1_completed_at ?? '',
      step2_completed_at:       iv.step2_completed_at ?? '',
      step3_completed_at:       iv.step3_completed_at ?? '',
      decision_date:            iv.decision_date ?? '',
      last_reviewed_at:         iv.last_reviewed_at ?? '',
      closed_at:                iv.closed_at ?? '',
    }
  })
}

async function exportPlacementZip(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>): Promise<Buffer> {
  const [apps, companies, roles] = await Promise.all([
    exportApplications(supabase),
    exportCompanies(supabase),
    exportRoles(supabase),
  ])
  const zip = new JSZip()
  zip.file('applications.csv', toCsv(apps))
  zip.file('companies.csv',    toCsv(companies))
  zip.file('roles.csv',        toCsv(roles))
  return zip.generateAsync({ type: 'nodebuffer' })
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Admin-only
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: appUser } = await supabase.from('users').select('role').eq('email', user.email!).single()
    if (!appUser || appUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const table = req.nextUrl.searchParams.get('table')
    const date  = new Date().toISOString().slice(0, 10)

    // Bundled placement download (zip of applications/companies/roles)
    if (table === 'placement') {
      const buf = await exportPlacementZip(supabase)
      return new NextResponse(buf, {
        headers: {
          'Content-Type':        'application/zip',
          'Content-Disposition': `attachment; filename="placement-data-${date}.zip"`,
        },
      })
    }

    let rows: Record<string, unknown>[]
    let filename: string

    switch (table) {
      case 'alumni':
        rows     = await exportAlumni(supabase)
        filename = `alumni-${date}.csv`
        break
      case 'interventions':
        rows     = await exportInterventions(supabase)
        filename = `interventions-${date}.csv`
        break
      case 'applications':
        rows     = await exportApplications(supabase)
        filename = `applications-${date}.csv`
        break
      case 'companies':
        rows     = await exportCompanies(supabase)
        filename = `companies-${date}.csv`
        break
      case 'roles':
        rows     = await exportRoles(supabase)
        filename = `roles-${date}.csv`
        break
      default:
        return NextResponse.json({ error: 'Unknown table. Use: alumni, interventions, placement, applications, companies, roles' }, { status: 400 })
    }

    const csv = toCsv(rows)

    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
