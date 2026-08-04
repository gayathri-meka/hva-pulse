const DEFAULT_PAGE_SIZE = 1000

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>
type OrderedQuery<T> = { range(from: number, to: number): PageResult<T> }

/** Load a deterministic ordered Supabase query past PostgREST's per-request cap. */
export async function fetchAllSupabaseRows<T>(query: OrderedQuery<T>, pageSize = DEFAULT_PAGE_SIZE): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('pageSize must be a positive integer')
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

/** Temporary compatibility for a feature table whose migration may not have
 * reached every environment yet. Other database failures must remain visible. */
export async function fetchAllSupabaseRowsIfTableExists<T>(
  query: OrderedQuery<T>,
  table: string,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  try {
    return await fetchAllSupabaseRows(query, pageSize)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes(`'public.${table}'`) && message.includes('schema cache')) return []
    throw error
  }
}
