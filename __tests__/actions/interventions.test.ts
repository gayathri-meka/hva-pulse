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
import { revalidatePath }             from 'next/cache'
import {
  startIntervention,
  saveInterventionStep1,
  saveInterventionStep2,
  saveInterventionStep3,
  saveActionItems,
  updateDecisionDate,
  saveUpdate,
  closeIntervention,
  clearInterventionStep1,
  deleteIntervention,
} from '@/app/(protected)/learning/actions'

const staffUser = { id: 'staff-1', role: 'admin' as const, name: 'Admin User', email: 'admin@test.com' }

function mockSupabaseBuilder(opts: {
  selectResult?:   { data: unknown; error: null | { message: string } }
  insertResult?:   { data: unknown; error: null | { message: string } }
  updateResult?:   { error: null | { message: string } }
  deleteResult?:   { error: null | { message: string } }
} = {}) {
  const mockSelectMaybe  = vi.fn().mockResolvedValue(opts.selectResult ?? { data: null, error: null })
  const mockSelectSingle = vi.fn().mockResolvedValue(opts.selectResult ?? { data: null, error: null })
  const mockNeq          = vi.fn().mockReturnValue({ maybeSingle: mockSelectMaybe })
  const mockEqSelect     = vi.fn().mockReturnValue({
    neq:         mockNeq,
    maybeSingle: mockSelectMaybe,
    single:      mockSelectSingle,
  })
  const mockSelect       = vi.fn().mockReturnValue({ eq: mockEqSelect, single: mockSelectSingle })

  const mockInsertSingle = vi.fn().mockResolvedValue(opts.insertResult ?? { data: { id: 'new-iv-1' }, error: null })
  const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle })
  const mockInsert       = vi.fn().mockReturnValue({ select: mockInsertSelect })

  const mockEqUpdate = vi.fn().mockResolvedValue(opts.updateResult ?? { error: null })
  const mockUpdate   = vi.fn().mockReturnValue({ eq: mockEqUpdate })

  const mockEqDelete = vi.fn().mockResolvedValue(opts.deleteResult ?? { error: null })
  const mockDelete   = vi.fn().mockReturnValue({ eq: mockEqDelete })

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })
  vi.mocked(createServerSupabaseClient).mockResolvedValue({ from: mockFrom } as any)

  return { mockFrom, mockInsert, mockUpdate, mockDelete, mockEqUpdate, mockSelectMaybe, mockSelectSingle }
}

describe('startIntervention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('throws when learner already has an active intervention', async () => {
    mockSupabaseBuilder({ selectResult: { data: { id: 'existing-iv' }, error: null } })
    await expect(startIntervention('learner-1')).rejects.toThrow('already has an active intervention')
  })

  test('inserts new intervention with opened_by and decision_date = now + 14 days', async () => {
    const { mockInsert } = mockSupabaseBuilder()

    const beforeCall = Date.now()
    await startIntervention('learner-1')
    const afterCall = Date.now()

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const payload = mockInsert.mock.calls[0][0] as { learner_id: string; opened_by: string; decision_date: string }

    expect(payload.learner_id).toBe('learner-1')
    expect(payload.opened_by).toBe('staff-1')
    expect(payload.decision_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Verify 14-day window (allow 1 day tolerance for the date of the test run)
    const decision    = new Date(payload.decision_date + 'T00:00:00Z').getTime()
    const expectedMin = new Date(beforeCall + 13 * 24 * 3600 * 1000).setUTCHours(0, 0, 0, 0)
    const expectedMax = new Date(afterCall  + 15 * 24 * 3600 * 1000).setUTCHours(0, 0, 0, 0)
    expect(decision).toBeGreaterThanOrEqual(expectedMin)
    expect(decision).toBeLessThanOrEqual(expectedMax)
  })

  test('revalidates both learning pages and returns new id', async () => {
    mockSupabaseBuilder()
    const id = await startIntervention('learner-1')
    expect(id).toBe('new-iv-1')
    expect(revalidatePath).toHaveBeenCalledWith('/learning')
    expect(revalidatePath).toHaveBeenCalledWith('/learning/learner-1')
  })
})

describe('saveInterventionStep1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('sets status to in_progress and stores flagged_items + notes', async () => {
    const { mockUpdate, mockEqUpdate } = mockSupabaseBuilder()
    await saveInterventionStep1('iv-1', { flagged_items: ['Attendance', 'Quiz scores'], what_wrong_notes: 'Behind schedule' })

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      flagged_items:    ['Attendance', 'Quiz scores'],
      what_wrong_notes: 'Behind schedule',
      status:           'in_progress',
    }))
    expect(mockEqUpdate).toHaveBeenCalledWith('id', 'iv-1')
  })

  test('stores null when notes is empty string', async () => {
    const { mockUpdate } = mockSupabaseBuilder()
    await saveInterventionStep1('iv-1', { flagged_items: ['Attendance'], what_wrong_notes: '' })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ what_wrong_notes: null }))
  })
})

describe('saveInterventionStep2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('stores multi-select root cause categories', async () => {
    const { mockUpdate } = mockSupabaseBuilder()
    await saveInterventionStep2('iv-1', {
      root_cause_categories: ['Life circumstance', 'External commitments'],
      root_cause_notes:      'Family emergency',
    })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      root_cause_categories: ['Life circumstance', 'External commitments'],
      root_cause_notes:      'Family emergency',
    }))
  })

  test('does not change status (step 2 is independent of status progression)', async () => {
    const { mockUpdate } = mockSupabaseBuilder()
    await saveInterventionStep2('iv-1', { root_cause_categories: [], root_cause_notes: '' })
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('status')
  })
})

describe('saveInterventionStep3', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('transitions status to follow_up on save', async () => {
    const { mockUpdate } = mockSupabaseBuilder()
    await saveInterventionStep3('iv-1', [
      { description: 'Call parent', owner: 'LF', due_date: '2026-05-01' },
    ])
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status:       'follow_up',
      action_items: [{ description: 'Call parent', owner: 'LF', due_date: '2026-05-01' }],
    }))
  })
})

describe('saveActionItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('persists completion timestamps without changing status', async () => {
    const { mockUpdate } = mockSupabaseBuilder()
    await saveActionItems('iv-1', [
      { description: 'Call parent', owner: 'LF', due_date: null, completed_at: '2026-04-20T10:00:00Z' },
    ])
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).toHaveProperty('action_items')
    expect(payload).not.toHaveProperty('status')
  })
})

describe('updateDecisionDate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('rejects invalid date format', async () => {
    mockSupabaseBuilder()
    await expect(updateDecisionDate('iv-1', '2026/05/01')).rejects.toThrow('Invalid date')
    await expect(updateDecisionDate('iv-1', 'tomorrow')).rejects.toThrow('Invalid date')
  })

  test('accepts YYYY-MM-DD and writes to decision_date column', async () => {
    const { mockUpdate } = mockSupabaseBuilder()
    await updateDecisionDate('iv-1', '2026-05-15')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ decision_date: '2026-05-15' }))
  })
})

describe('saveUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('rejects empty note', async () => {
    mockSupabaseBuilder()
    await expect(saveUpdate('iv-1', '   ', null)).rejects.toThrow('Note is required')
  })

  test('rejects invalid new decision date', async () => {
    mockSupabaseBuilder()
    await expect(saveUpdate('iv-1', 'ok', 'bad-date')).rejects.toThrow('Invalid date')
  })

  test('appends entry to update_log preserving prior entries', async () => {
    const priorEntries = [{ at: '2026-04-01T00:00:00Z', note: 'prior', by: null, by_name: null, decision_date_pushed_to: null }]
    const { mockUpdate } = mockSupabaseBuilder({
      selectResult: { data: { update_log: priorEntries, learner_id: 'learner-1' }, error: null },
    })

    await saveUpdate('iv-1', 'follow-up call complete', null)

    const payload = mockUpdate.mock.calls[0][0] as { update_log: unknown[] }
    expect(payload.update_log).toHaveLength(2)
    expect(payload.update_log[0]).toEqual(priorEntries[0])
    expect(payload.update_log[1]).toMatchObject({
      note:                    'follow-up call complete',
      by:                      'staff-1',
      by_name:                 'Admin User',
      decision_date_pushed_to: null,
    })
  })

  test('also pushes decision_date forward when newDecisionDate is provided', async () => {
    const { mockUpdate } = mockSupabaseBuilder({
      selectResult: { data: { update_log: [], learner_id: 'learner-1' }, error: null },
    })
    await saveUpdate('iv-1', 'pushing by a week', '2026-05-28')

    const payload = mockUpdate.mock.calls[0][0] as { update_log: any[]; decision_date?: string }
    expect(payload.decision_date).toBe('2026-05-28')
    expect(payload.update_log[0]).toMatchObject({ decision_date_pushed_to: '2026-05-28' })
  })

  test('does not set decision_date when newDecisionDate is null', async () => {
    const { mockUpdate } = mockSupabaseBuilder({
      selectResult: { data: { update_log: [], learner_id: 'learner-1' }, error: null },
    })
    await saveUpdate('iv-1', 'just a note', null)
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('decision_date')
  })
})

describe('closeIntervention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('rejects empty outcome note', async () => {
    mockSupabaseBuilder()
    await expect(closeIntervention('iv-1', 'learner-1', 'resolved', '   ')).rejects.toThrow('Outcome note is required')
  })

  test('sets status=closed and records closer', async () => {
    const { mockUpdate } = mockSupabaseBuilder()
    await closeIntervention('iv-1', 'learner-1', 'resolved', 'Learner back on track')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status:       'closed',
      outcome:      'resolved',
      outcome_note: 'Learner back on track',
      closed_by:    'staff-1',
    }))
  })

  test('revalidates learner detail page', async () => {
    mockSupabaseBuilder()
    await closeIntervention('iv-1', 'learner-42', 'dropped', 'Left programme')
    expect(revalidatePath).toHaveBeenCalledWith('/learning/learner-42')
  })
})

describe('clearInterventionStep1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('resets status back to open when step 2 not yet completed', async () => {
    const { mockUpdate } = mockSupabaseBuilder({
      selectResult: { data: { step2_completed_at: null, learner_id: 'learner-1' }, error: null },
    })
    await clearInterventionStep1('iv-1')
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      flagged_items:      [],
      what_wrong_notes:   null,
      step1_completed_at: null,
      status:             'open',
    }))
  })

  test('does not touch status when step 2 is already completed', async () => {
    const { mockUpdate } = mockSupabaseBuilder({
      selectResult: { data: { step2_completed_at: '2026-04-01T00:00:00Z', learner_id: 'learner-1' }, error: null },
    })
    await clearInterventionStep1('iv-1')
    const payload = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(payload).not.toHaveProperty('status')
  })
})

describe('deleteIntervention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireStaff).mockResolvedValue(staffUser)
  })

  test('deletes and revalidates affected learner page', async () => {
    const { mockDelete } = mockSupabaseBuilder({
      selectResult: { data: { learner_id: 'learner-7' }, error: null },
    })
    await deleteIntervention('iv-1')
    expect(mockDelete).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/learning/learner-7')
  })
})
