import { describe, test, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ requireStaff: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ createServerSupabaseClient: vi.fn() }))

import { requireStaff } from '@/lib/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { closeTicket, reopenTicket, editTicket, replyToTicket } from '@/app/(protected)/tickets/actions'

const spocUser = { id: 'u1', role: 'staff' as const, name: 'Hrishi', email: 'hrishi@hyperverge.co' }
const adminUser = { id: 'u0', role: 'admin' as const, name: 'Boss', email: 'boss@hyperverge.co' }
const outsiderUser = { id: 'u2', role: 'staff' as const, name: 'Nobody', email: 'nobody@hyperverge.co' }

// Supabase mock returning a ticket with these spoc_emails for the permission check.
function mockSupabaseTicket(spoc_emails: string[] | null) {
  const client = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: spoc_emails === null ? null : { spoc_emails } }),
        }),
      }),
    }),
  }
  vi.mocked(createServerSupabaseClient).mockResolvedValue(client as never)
}

function mockFetch(ok: boolean, body: unknown) {
  return vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://proj.supabase.co')
  vi.stubEnv('HVA_PULSE_EDGE_SECRET', 'test-secret')
})

describe('closeTicket', () => {
  test('redirects when caller is not staff', async () => {
    vi.mocked(requireStaff).mockImplementation(() => { throw new Error('NEXT_REDIRECT:/dashboard') })
    await expect(closeTicket('T1')).rejects.toThrow('NEXT_REDIRECT')
  })

  test('rejects a staff user who is not a SPOC or admin', async () => {
    vi.mocked(requireStaff).mockResolvedValue(outsiderUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await closeTicket('T1')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/assigned SPOC or an admin/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('assigned SPOC closes: posts the right body to the edge', async () => {
    vi.mocked(requireStaff).mockResolvedValue(spocUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await closeTicket('T1')
    expect(res.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://proj.supabase.co/functions/v1/hva-slack-router')
    const sent = JSON.parse((opts as { body: string }).body)
    expect(sent).toMatchObject({ source: 'pulse', secret: 'test-secret', action: 'close', ticketId: 'T1', actorEmail: 'hrishi@hyperverge.co' })
  })

  test('admin can close a ticket they are not a SPOC on', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await closeTicket('T1')
    expect(res.ok).toBe(true)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  test('surfaces an edge error', async () => {
    vi.mocked(requireStaff).mockResolvedValue(spocUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    vi.stubGlobal('fetch', mockFetch(false, { ok: false, error: 'ticket not found' }))

    const res = await closeTicket('T1')
    expect(res).toEqual({ ok: false, error: 'ticket not found' })
  })

  test('errors when the ticket does not exist', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    mockSupabaseTicket(null)
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await closeTicket('T1')
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/not found/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('reopenTicket', () => {
  test('assigned SPOC reopens: action=reopen', async () => {
    vi.mocked(requireStaff).mockResolvedValue(spocUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await reopenTicket('T1')
    expect(res.ok).toBe(true)
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(sent.action).toBe('reopen')
  })
})

describe('editTicket', () => {
  test('sends the edited fields to the edge', async () => {
    vi.mocked(requireStaff).mockResolvedValue(adminUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await editTicket('T1', { priority: 'High', spoc_emails: ['a@x.co', 'b@x.co'] })
    expect(res.ok).toBe(true)
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(sent).toMatchObject({ action: 'edit', ticketId: 'T1', fields: { priority: 'High', spoc_emails: ['a@x.co', 'b@x.co'] } })
  })
})

describe('replyToTicket', () => {
  function fd(fields: Record<string, string>) {
    const f = new FormData()
    Object.entries(fields).forEach(([k, v]) => f.set(k, v))
    return f
  }

  test('rejects an empty body', async () => {
    vi.mocked(requireStaff).mockResolvedValue(spocUser)
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await replyToTicket(fd({ ticketId: 'T1', body: '   ' }))
    expect(res.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('assigned SPOC reply posts body + toSide to the edge', async () => {
    vi.mocked(requireStaff).mockResolvedValue(spocUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await replyToTicket(fd({ ticketId: 'T1', body: 'Looking into it', toSide: 'requester' }))
    expect(res.ok).toBe(true)
    const sent = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(sent).toMatchObject({ action: 'reply', ticketId: 'T1', body: 'Looking into it', toSide: 'requester', actorEmail: 'hrishi@hyperverge.co' })
  })

  test('non-SPOC reply is rejected before hitting the edge', async () => {
    vi.mocked(requireStaff).mockResolvedValue(outsiderUser)
    mockSupabaseTicket(['hrishi@hyperverge.co'])
    const fetchSpy = mockFetch(true, { ok: true })
    vi.stubGlobal('fetch', fetchSpy)

    const res = await replyToTicket(fd({ ticketId: 'T1', body: 'hello', toSide: 'requester' }))
    expect(res.ok).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
