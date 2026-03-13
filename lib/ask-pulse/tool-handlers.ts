import type { SupabaseClient } from '@supabase/supabase-js'
import type { ToolName } from './tools'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampLimit(value: number | undefined, def: number, max: number): number {
  if (!value || value < 1) return def
  return Math.min(value, max)
}

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length === 0) return null
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
}

/**
 * Resolve company name → id using the correct column name (company_name, not name).
 * Returns null if not found.
 */
async function resolveCompanyId(
  companyName: string,
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .ilike('company_name', `%${companyName}%`)
    .single()
  return data?.id ?? null
}

/** Resolve company id → role ids. Returns null (no filter) if companyId is null. */
async function resolveRoleIds(
  companyId: string,
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data } = await supabase
    .from('roles')
    .select('id')
    .eq('company_id', companyId)
  return (data ?? []).map((r) => r.id)
}

// ─── Handlers ────────────────────────────────────────────────────────────────

async function getBatches(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('learners')
    .select('batch_name')
    .not('batch_name', 'is', null)
    .order('batch_name')
  if (error) throw error
  const batches = [...new Set((data ?? []).map((r) => r.batch_name as string))].sort()
  return { batches }
}

async function getLearners(
  args: {
    batch_name?: string
    lf_name?: string
    readiness?: string[]
    blacklisted?: boolean
    limit?: number
  },
  supabase: SupabaseClient,
) {
  const limit = clampLimit(args.limit, 50, 200)

  let lfUserIds: string[] | null = null
  if (args.lf_name) {
    const { data: lfUsers } = await supabase
      .from('users')
      .select('id')
      .ilike('name', `%${args.lf_name}%`)
      .eq('role', 'LF')
    lfUserIds = (lfUsers ?? []).map((u) => u.id)
    if (lfUserIds.length === 0) return { learners: [], total: 0 }
  }

  // learners_user_id_fkey and learners_lf_user_id_fkey are explicitly named in migration 001.
  let q = supabase
    .from('learners')
    .select(
      `learner_id, batch_name, track, readiness, blacklisted_date, new_lf,
       user:users!learners_user_id_fkey(name, email),
       lf:users!learners_lf_user_id_fkey(name)`,
    )
    .limit(limit)

  if (args.batch_name) q = q.eq('batch_name', args.batch_name)
  if (args.readiness?.length) q = q.in('readiness', args.readiness)
  if (args.blacklisted === true) q = q.not('blacklisted_date', 'is', null)
  if (args.blacklisted === false) q = q.is('blacklisted_date', null)
  if (lfUserIds) q = q.in('lf_user_id', lfUserIds)

  const { data, error } = await q
  if (error) throw error
  return { learners: data ?? [], total: (data ?? []).length }
}

async function getLearnerDetail(
  args: { learner_id?: string; email?: string },
  supabase: SupabaseClient,
) {
  let q = supabase.from('learners').select(
    `learner_id, batch_name, track, readiness, blacklisted_date, new_lf,
     year_of_graduation, degree, specialisation, current_location,
     prs, proactiveness, articulation, comprehension, tech_score,
     user:users!learners_user_id_fkey(name, email),
     lf:users!learners_lf_user_id_fkey(name)`,
  )

  if (args.learner_id) {
    q = q.eq('learner_id', args.learner_id)
  } else if (args.email) {
    const { data: u } = await supabase
      .from('users')
      .select('id')
      .eq('email', args.email)
      .single()
    if (!u) return { learner: null }
    q = q.eq('user_id', u.id)
  } else {
    return { learner: null, error: 'Provide learner_id or email.' }
  }

  const { data, error } = await q.single()
  if (error) return { learner: null }
  return { learner: data }
}

async function getLearnerApplications(
  args: { learner_id?: string; email?: string },
  supabase: SupabaseClient,
) {
  let userId: string | null = null
  if (args.learner_id) {
    const { data } = await supabase
      .from('learners')
      .select('user_id')
      .eq('learner_id', args.learner_id)
      .single()
    userId = data?.user_id ?? null
  } else if (args.email) {
    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('email', args.email)
      .single()
    userId = data?.id ?? null
  }
  if (!userId) return { applications: [] }

  // Fetch applications (no embedded joins — FK constraint names on applications are not known).
  const { data: apps, error } = await supabase
    .from('applications')
    .select(
      'id, role_id, status, created_at, not_shortlisted_reason, not_shortlisted_reasons, rejection_feedback, rejection_reasons',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!apps?.length) return { applications: [] }

  // Fetch roles and companies separately, then join in JS.
  const roleIds = [...new Set(apps.map((a) => a.role_id).filter(Boolean))]
  const { data: roles } = await supabase
    .from('roles')
    .select('id, role_title, company_id')
    .in('id', roleIds)

  const companyIds = [...new Set((roles ?? []).map((r) => r.company_id).filter(Boolean))]
  const { data: companies } = await supabase
    .from('companies')
    .select('id, company_name')
    .in('id', companyIds)

  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r]))
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.company_name]))

  return {
    applications: apps.map((a) => ({
      ...a,
      role_title: roleMap[a.role_id]?.role_title ?? null,
      company_name: companyMap[roleMap[a.role_id]?.company_id] ?? null,
    })),
  }
}

async function getPipelineSummary(
  args: { batch_name?: string; company_name?: string },
  supabase: SupabaseClient,
) {
  let userIds: string[] | null = null
  if (args.batch_name) {
    const { data } = await supabase
      .from('learners')
      .select('user_id')
      .eq('batch_name', args.batch_name)
    userIds = (data ?? []).map((r) => r.user_id).filter(Boolean)
    if (userIds.length === 0) return { summary: {}, total: 0, scope: args }
  }

  let roleIds: string[] | null = null
  if (args.company_name) {
    const companyId = await resolveCompanyId(args.company_name, supabase)
    if (!companyId) return { summary: {}, total: 0, scope: args }
    const ids = await resolveRoleIds(companyId, supabase)
    if (ids.length === 0) return { summary: {}, total: 0, scope: args }
    roleIds = ids
  }

  let q = supabase.from('applications').select('status')
  if (userIds) q = q.in('user_id', userIds)
  if (roleIds) q = q.in('role_id', roleIds)

  const { data, error } = await q
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  return { summary: counts, total: Object.values(counts).reduce((a, b) => a + b, 0), scope: args }
}

async function getApplications(
  args: {
    status?: string[]
    company_name?: string
    batch_name?: string
    limit?: number
  },
  supabase: SupabaseClient,
) {
  const limit = clampLimit(args.limit, 50, 200)

  let userIds: string[] | null = null
  if (args.batch_name) {
    const { data } = await supabase
      .from('learners')
      .select('user_id')
      .eq('batch_name', args.batch_name)
    userIds = (data ?? []).map((r) => r.user_id).filter(Boolean)
    if (userIds.length === 0) return { applications: [] }
  }

  let roleIds: string[] | null = null
  if (args.company_name) {
    const companyId = await resolveCompanyId(args.company_name, supabase)
    if (!companyId) return { applications: [] }
    const ids = await resolveRoleIds(companyId, supabase)
    if (ids.length === 0) return { applications: [] }
    roleIds = ids
  }

  let q = supabase
    .from('applications')
    .select('id, user_id, role_id, status, created_at')
    .limit(limit)
    .order('created_at', { ascending: false })
  if (args.status?.length) q = q.in('status', args.status)
  if (userIds) q = q.in('user_id', userIds)
  if (roleIds) q = q.in('role_id', roleIds)

  const { data: apps, error } = await q
  if (error) throw error
  if (!apps?.length) return { applications: [] }

  // Fetch users, roles, companies separately.
  const uids = [...new Set(apps.map((a) => a.user_id).filter(Boolean))]
  const rids = [...new Set(apps.map((a) => a.role_id).filter(Boolean))]

  const [{ data: users }, { data: roles }] = await Promise.all([
    supabase.from('users').select('id, name, email').in('id', uids),
    supabase.from('roles').select('id, role_title, company_id').in('id', rids),
  ])

  const cids = [...new Set((roles ?? []).map((r) => r.company_id).filter(Boolean))]
  const { data: companies } = await supabase
    .from('companies')
    .select('id, company_name')
    .in('id', cids)

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))
  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r]))
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.company_name]))

  return {
    applications: apps.map((a) => ({
      id: a.id,
      status: a.status,
      created_at: a.created_at,
      learner_name: userMap[a.user_id]?.name ?? null,
      learner_email: userMap[a.user_id]?.email ?? null,
      role_title: roleMap[a.role_id]?.role_title ?? null,
      company_name: companyMap[roleMap[a.role_id]?.company_id] ?? null,
    })),
  }
}

async function getCompanies(supabase: SupabaseClient) {
  const { data: companies, error } = await supabase
    .from('companies')
    .select('id, company_name, sort_order')
    .order('sort_order')
  if (error) throw error

  const { data: roles } = await supabase.from('roles').select('id, company_id, status')

  const rolesByCompany = new Map<string, { total: number; open: number }>()
  for (const r of roles ?? []) {
    const cur = rolesByCompany.get(r.company_id) ?? { total: 0, open: 0 }
    cur.total++
    if (r.status === 'open') cur.open++
    rolesByCompany.set(r.company_id, cur)
  }

  return {
    companies: (companies ?? []).map((c) => ({
      name: c.company_name,
      total_roles: rolesByCompany.get(c.id)?.total ?? 0,
      open_roles: rolesByCompany.get(c.id)?.open ?? 0,
    })),
  }
}

async function getRoles(
  args: { company_name?: string; status?: 'open' | 'closed' | 'all' },
  supabase: SupabaseClient,
) {
  let companyId: string | null = null
  if (args.company_name) {
    companyId = await resolveCompanyId(args.company_name, supabase)
    if (!companyId) return { roles: [] }
  }

  let q = supabase
    .from('roles')
    .select('id, role_title, status, created_at, company_id')
    .order('created_at', { ascending: false })
  if (args.status && args.status !== 'all') q = q.eq('status', args.status)
  if (companyId) q = q.eq('company_id', companyId)

  const { data: roles, error } = await q
  if (error) throw error
  if (!roles?.length) return { roles: [] }

  const cids = [...new Set(roles.map((r) => r.company_id).filter(Boolean))]
  const { data: companies } = await supabase
    .from('companies')
    .select('id, company_name')
    .in('id', cids)
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.company_name]))

  return {
    roles: roles.map((r) => ({
      id: r.id,
      role_title: r.role_title,
      status: r.status,
      created_at: r.created_at,
      company_name: companyMap[r.company_id] ?? null,
    })),
  }
}

async function getHiredLearners(
  args: { batch_name?: string; company_name?: string },
  supabase: SupabaseClient,
) {
  let userIds: string[] | null = null
  if (args.batch_name) {
    const { data } = await supabase
      .from('learners')
      .select('user_id')
      .eq('batch_name', args.batch_name)
    userIds = (data ?? []).map((r) => r.user_id).filter(Boolean)
    if (userIds.length === 0) return { hired: [], count: 0 }
  }

  let roleIds: string[] | null = null
  if (args.company_name) {
    const companyId = await resolveCompanyId(args.company_name, supabase)
    if (!companyId) return { hired: [], count: 0 }
    const ids = await resolveRoleIds(companyId, supabase)
    if (ids.length === 0) return { hired: [], count: 0 }
    roleIds = ids
  }

  let q = supabase
    .from('applications')
    .select('user_id, role_id, hiring_decision_taken_at')
    .eq('status', 'hired')
    .order('hiring_decision_taken_at', { ascending: false })
  if (userIds) q = q.in('user_id', userIds)
  if (roleIds) q = q.in('role_id', roleIds)

  const { data: apps, error } = await q
  if (error) throw error
  if (!apps?.length) return { hired: [], count: 0 }

  const uids = [...new Set(apps.map((a) => a.user_id).filter(Boolean))]
  const rids = [...new Set(apps.map((a) => a.role_id).filter(Boolean))]

  const [{ data: users }, { data: roles }] = await Promise.all([
    supabase.from('users').select('id, name, email').in('id', uids),
    supabase.from('roles').select('id, role_title, company_id').in('id', rids),
  ])

  const cids = [...new Set((roles ?? []).map((r) => r.company_id).filter(Boolean))]
  const { data: companies } = await supabase
    .from('companies')
    .select('id, company_name')
    .in('id', cids)

  const userMap = Object.fromEntries((users ?? []).map((u) => [u.id, u]))
  const roleMap = Object.fromEntries((roles ?? []).map((r) => [r.id, r]))
  const companyMap = Object.fromEntries((companies ?? []).map((c) => [c.id, c.company_name]))

  return {
    hired: apps.map((a) => ({
      learner_name: userMap[a.user_id]?.name ?? null,
      learner_email: userMap[a.user_id]?.email ?? null,
      role_title: roleMap[a.role_id]?.role_title ?? null,
      company_name: companyMap[roleMap[a.role_id]?.company_id] ?? null,
      hired_at: a.hiring_decision_taken_at,
    })),
    count: apps.length,
  }
}

async function getTatMetrics(
  args: { batch_name?: string; company_name?: string },
  supabase: SupabaseClient,
) {
  let userIds: string[] | null = null
  if (args.batch_name) {
    const { data } = await supabase
      .from('learners')
      .select('user_id')
      .eq('batch_name', args.batch_name)
    userIds = (data ?? []).map((r) => r.user_id).filter(Boolean)
    if (userIds.length === 0) return { metrics: null, sample_size: 0 }
  }

  let roleIds: string[] | null = null
  if (args.company_name) {
    const companyId = await resolveCompanyId(args.company_name, supabase)
    if (companyId) {
      roleIds = await resolveRoleIds(companyId, supabase)
    }
  }

  let q = supabase
    .from('applications')
    .select(
      'created_at, shortlisting_decision_taken_at, interviews_started_at, hiring_decision_taken_at',
    )
    .not('shortlisting_decision_taken_at', 'is', null)
  if (userIds) q = q.in('user_id', userIds)
  if (roleIds) q = q.in('role_id', roleIds)

  const { data, error } = await q
  if (error) throw error
  if (!data?.length) return { metrics: null, sample_size: 0 }

  return {
    metrics: {
      avg_days_to_shortlist_decision: avg(
        data.map((r) => daysBetween(r.created_at, r.shortlisting_decision_taken_at)),
      ),
      avg_days_shortlist_to_interview: avg(
        data.map((r) =>
          daysBetween(r.shortlisting_decision_taken_at, r.interviews_started_at),
        ),
      ),
      avg_days_interview_to_hiring_decision: avg(
        data
          .filter((r) => r.hiring_decision_taken_at)
          .map((r) => daysBetween(r.interviews_started_at, r.hiring_decision_taken_at)),
      ),
    },
    sample_size: data.length,
    scope: args,
  }
}

async function getJobPersonas(
  args: { active_only?: boolean },
  supabase: SupabaseClient,
) {
  let q = supabase
    .from('job_personas')
    .select(
      'id, name, target_job_titles, required_skills, experience_min, experience_max, preferred_locations, remote_allowed, entry_level_only, active',
    )
    .order('name')
  if (args.active_only) q = q.eq('active', true)
  const { data, error } = await q
  if (error) throw error
  return { personas: data ?? [] }
}

async function getJobOpportunities(
  args: { persona_name?: string; status?: string[]; limit?: number },
  supabase: SupabaseClient,
) {
  const limit = clampLimit(args.limit, 20, 100)

  let personaId: string | null = null
  if (args.persona_name) {
    const { data } = await supabase
      .from('job_personas')
      .select('id')
      .ilike('name', `%${args.persona_name}%`)
      .single()
    personaId = data?.id ?? null
    if (!personaId) return { opportunities: [] }
  }

  let q = supabase
    .from('job_opportunities')
    .select('id, persona_id, job_title, company_name, location, source_platform, date_posted, status, notes, created_at')
    .order('date_posted', { ascending: false })
    .limit(limit)
  if (args.status?.length) q = q.in('status', args.status)
  if (personaId) q = q.eq('persona_id', personaId)

  const { data: opps, error } = await q
  if (error) throw error
  if (!opps?.length) return { opportunities: [] }

  // Fetch persona names separately.
  const pids = [...new Set(opps.map((o) => o.persona_id).filter(Boolean))]
  const { data: personas } = await supabase
    .from('job_personas')
    .select('id, name')
    .in('id', pids)
  const personaMap = Object.fromEntries((personas ?? []).map((p) => [p.id, p.name]))

  return {
    opportunities: opps.map((o) => ({ ...o, persona_name: personaMap[o.persona_id] ?? null })),
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export async function executeToolCall(
  name: ToolName,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<unknown> {
  switch (name) {
    case 'get_batches':
      return getBatches(supabase)
    case 'get_learners':
      return getLearners(args as Parameters<typeof getLearners>[0], supabase)
    case 'get_learner_detail':
      return getLearnerDetail(args as Parameters<typeof getLearnerDetail>[0], supabase)
    case 'get_learner_applications':
      return getLearnerApplications(args as Parameters<typeof getLearnerApplications>[0], supabase)
    case 'get_pipeline_summary':
      return getPipelineSummary(args as Parameters<typeof getPipelineSummary>[0], supabase)
    case 'get_applications':
      return getApplications(args as Parameters<typeof getApplications>[0], supabase)
    case 'get_companies':
      return getCompanies(supabase)
    case 'get_roles':
      return getRoles(args as Parameters<typeof getRoles>[0], supabase)
    case 'get_hired_learners':
      return getHiredLearners(args as Parameters<typeof getHiredLearners>[0], supabase)
    case 'get_tat_metrics':
      return getTatMetrics(args as Parameters<typeof getTatMetrics>[0], supabase)
    case 'get_job_personas':
      return getJobPersonas(args as Parameters<typeof getJobPersonas>[0], supabase)
    case 'get_job_opportunities':
      return getJobOpportunities(args as Parameters<typeof getJobOpportunities>[0], supabase)
  }
}
