export function updateUrlParams(
  current: string,
  updates: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams(current)
  for (const [key, value] of Object.entries(updates)) {
    if (value == null || value === '') params.delete(key)
    else params.set(key, value)
  }
  return params.toString()
}

export function enumParam<T extends string>(
  params: Pick<URLSearchParams, 'get'>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = params.get(key)
  return value && allowed.includes(value as T) ? value as T : fallback
}
