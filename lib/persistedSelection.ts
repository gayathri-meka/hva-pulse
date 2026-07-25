export function reconcileSelection(
  selected: ReadonlySet<string>,
  availableValues: Iterable<string>,
  fallbackToAll = false,
) {
  const available = new Set(availableValues)
  const reconciled = new Set([...selected].filter((value) => available.has(value)))
  return fallbackToAll && reconciled.size === 0 ? available : reconciled
}

export function setsEqual(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return left.size === right.size && [...left].every((value) => right.has(value))
}
