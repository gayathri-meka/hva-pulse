import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({
  getAppUser:   vi.fn(),
  requireStaff: vi.fn(),
}))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))
vi.mock('@/lib/google',   () => ({ getSheetRaw: vi.fn(), getSheetRows: vi.fn() }))
vi.mock('@/lib/bigquery', () => ({ runBigQuery: vi.fn() }))

import { requireStaff }               from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  attachCaseTrigger,
  removeCaseTrigger,
  updateCaseSeverity,
  updateCaseAccountableTeam,
  getCaseSummaryForLearner,
} from '@/app/(protected)/learning/actions'

const staffUser = { id: 'staff-1', role: 'admin' as const, name: 'Admin User', email: 'admin@test.com' }

// ── Mock builder ──────────────────────────────────────────────────────────────
// Per-table dispatch lets a single test exercise queries against
// case_triggers + cases without one table's mock leaking into another. Each
// table entry returns a thenable chain that resolves to whatever the test
// configured.

type ChainResult = unknown

type TableMock = {
  /** maybeSingle / single / count-tail resolved value. */
  select?: ChainResult
  insert?: ChainResult
  update?: ChainResult
  delete?: ChainResult
}

function makeChainFor(table: string, mocks: Record<string, TableMock>) {
  const m = mocks[table] ?? {}

  // Thenable so a bare `await` on a chain (e.g. .eq().eq()) resolves directly,
  // matching the supabase-js head-count / update / delete shapes.
  const makeThenable = (value: ChainResult) => {
    const obj: Record<string, unknown> = {
      eq:          (..._a: unknown[]) => obj,
      neq:         (..._a: unknown[]) => obj,
      in:          (..._a: unknown[]) => obj,
      order:       (..._a: unknown[]) => obj,
      limit:       (..._a: unknown[]) => obj,
      maybeSingle: vi.fn().mockResolvedValue(value),
      single:      vi.fn().mockResolvedValue(value),
      select:      (..._a: unknown[]) => obj,
      then:        (resolve: (v: ChainResult) => unknown) => Promise.resolve(value).then(resolve),
    }
    return obj
  }

  return {
    select: vi.fn(() => makeThenable(m.select ?? { data: null, error: null })),
    insert: vi.fn(() => makeThenable(m.insert ?? { data: null, error: null })),
    update: vi.fn(() => makeThenable(m.update ?? { error: null })),
    delete: vi.fn(() => makeThenable(m.delete ?? { error: null })),
  }
}

function mockSupabaseByTable(mocks: Record<string, TableMock>) {
  const tables: Record<string, ReturnType<typeof makeChainFor>> = {}
  const mockFrom = vi.fn((table: string) => {
    if (!tables[table]) tables[table] = makeChainFor(table, mocks)
    return tables[table]
  })
  vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: mockFrom } as never)
  return { mockFrom, tables }
}

// ── attachCaseTrigger ────────────────────────────────────────────────────────

describe('attachCaseTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('inserts an observation trigger row with the correct kind + FK', async () => {
    const { tables } = mockSupabaseByTable({})
    await attachCaseTrigger('case-1', { kind: 'observation', observation_id: 'obs-9' })

    const triggersTable = tables['case_triggers']
    expect(triggersTable).toBeDefined()
    expect(triggersTable.insert).toHaveBeenCalledWith({
      case_id:        'case-1',
      kind:           'observation',
      observation_id: 'obs-9',
      created_by:     'staff-1',
    })
  })

  test('inserts a metric trigger row with period label + value', async () => {
    const { tables } = mockSupabaseByTable({})
    await attachCaseTrigger('case-2', {
      kind:                'metric',
      metric_id:           'metric-3',
      metric_period_label: 'Week of 19 May',
      metric_value:        32,
    })

    expect(tables['case_triggers'].insert).toHaveBeenCalledWith({
      case_id:             'case-2',
      kind:                'metric',
      metric_id:           'metric-3',
      metric_period_label: 'Week of 19 May',
      metric_value:        32,
      created_by:          'staff-1',
    })
  })
})

// ── removeCaseTrigger ────────────────────────────────────────────────────────

describe('removeCaseTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('deletes the trigger row by id', async () => {
    const { tables } = mockSupabaseByTable({})
    await removeCaseTrigger('trigger-5')

    expect(tables['case_triggers'].delete).toHaveBeenCalled()
  })
})

// ── updateCaseSeverity ───────────────────────────────────────────────────────

describe('updateCaseSeverity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test.each(['Low', 'Medium', 'High'] as const)('accepts %s', async (sev) => {
    const { tables } = mockSupabaseByTable({})
    await updateCaseSeverity('iv-1', sev)
    expect(tables['cases'].update).toHaveBeenCalledWith(expect.objectContaining({ severity: sev }))
  })

  test('accepts null to clear', async () => {
    const { tables } = mockSupabaseByTable({})
    await updateCaseSeverity('iv-1', null)
    expect(tables['cases'].update).toHaveBeenCalledWith(expect.objectContaining({ severity: null }))
  })

  test('rejects invalid severity value', async () => {
    mockSupabaseByTable({})
    // @ts-expect-error — invalid runtime value on purpose
    await expect(updateCaseSeverity('iv-1', 'Severe')).rejects.toThrow(/Severity must be/)
  })
})

// ── updateCaseAccountableTeam ────────────────────────────────────────────────

describe('updateCaseAccountableTeam', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test.each(['Program', 'Learning'] as const)('accepts %s', async (team) => {
    const { tables } = mockSupabaseByTable({})
    await updateCaseAccountableTeam('iv-1', team)
    expect(tables['cases'].update).toHaveBeenCalledWith(expect.objectContaining({ accountable_team: team }))
  })

  test('accepts null to clear', async () => {
    const { tables } = mockSupabaseByTable({})
    await updateCaseAccountableTeam('iv-1', null)
    expect(tables['cases'].update).toHaveBeenCalledWith(expect.objectContaining({ accountable_team: null }))
  })

  test('rejects invalid team value', async () => {
    mockSupabaseByTable({})
    // @ts-expect-error — invalid runtime value on purpose
    await expect(updateCaseAccountableTeam('iv-1', 'Mentors')).rejects.toThrow(/must be Program or Learning/)
  })
})

// ── getCaseSummaryForLearner ─────────────────────────────────────────────────

describe('getCaseSummaryForLearner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('returns null + 0 when the learner has no cases', async () => {
    // First .from('cases') call (active lookup) returns maybeSingle data=null,
    // second .from('cases') call (count) returns count=0. With the per-table
    // mock dispatch, both routes return the configured shape, so we set it
    // to satisfy both — null data and count=0 are both compatible.
    mockSupabaseByTable({
      cases: { select: { data: null, error: null, count: 0 } },
    })
    const out = await getCaseSummaryForLearner('learner-1')
    expect(out).toEqual({ activeCaseId: null, closedCount: 0 })
  })

  test('surfaces the active case id when one exists', async () => {
    // The select chain returns { data: { id }, error } for the maybeSingle
    // branch (active) and the same value resolves the count branch — we only
    // read .data?.id for the first and .count for the second, so providing
    // both fields on the same value satisfies both queries.
    mockSupabaseByTable({
      cases: { select: { data: { id: 'iv-active-9' }, error: null, count: 0 } },
    })
    const out = await getCaseSummaryForLearner('learner-2')
    expect(out.activeCaseId).toBe('iv-active-9')
  })

  test('reports closed case count when set', async () => {
    mockSupabaseByTable({
      cases: { select: { data: null, error: null, count: 3 } },
    })
    const out = await getCaseSummaryForLearner('learner-3')
    expect(out.closedCount).toBe(3)
  })
})
