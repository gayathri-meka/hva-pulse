import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function readSetting<T>(key: string): Promise<T | null> {
  const { data } = await adminClient()
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  return (data?.value as T) ?? null
}

export async function readSettings(keys: string[]): Promise<Record<string, unknown>> {
  const { data } = await adminClient()
    .from('settings')
    .select('key, value')
    .in('key', keys)
  const result: Record<string, unknown> = {}
  for (const row of data ?? []) result[row.key] = row.value
  return result
}
