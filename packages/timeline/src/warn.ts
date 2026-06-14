const warned = new Set<string>()
// Reached via globalThis so the package needs neither the DOM nor Node lib.
const sink = (globalThis as { console?: { warn?: (message: string) => void } }).console

/**
 * Print a dev warning once per key, then stay quiet. core's warnOnce is
 * package-private, so the timeline ships its own (same `[underlying]` prefix).
 */
export function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return
  warned.add(key)
  sink?.warn?.(`[underlying] ${message}`)
}
