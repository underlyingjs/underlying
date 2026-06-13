// Deduplicated, prefixed console.warn for design-boundary conditions:
// unconvertible units, snap fallbacks, shorthand traps. One message per key
// for the lifetime of the process - never a per-frame log. Ships always-on
// (no __DEV__ dual build: it would complicate the exports map and the size
// gate); the message text is centralized and budgeted instead.
const seen = new Set<string>()

export function warnOnce(key: string, message: string): void {
  if (seen.has(key)) return
  seen.add(key)
  console.warn(`[underlying] ${message}`)
}

/** Test-only: clears the dedup set so a fresh key warns again. Not exported from the entry. */
export function __resetWarnings(): void {
  seen.clear()
}
