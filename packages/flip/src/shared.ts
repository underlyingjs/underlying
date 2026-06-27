import type { Box } from './engine'

// A module-global registry of boxes published by exiting elements, keyed by
// data-flip-id, so an entering element elsewhere (another container, the next
// route) can claim the box and fly from it. Consume-on-claim, with a TTL so a
// box that is never claimed cannot fly a much-later re-enter from a stale place.
interface Entry {
  box: Box
  expires: number
}

const registry = new Map<string, Entry>()

export function publishShared(id: string, box: Box, ttlMs: number): void {
  const now = Date.now()
  // Opportunistic sweep: an id that is published but never claimed must not linger,
  // so the TTL governs residency, not just the claim decision.
  for (const [key, entry] of registry) if (entry.expires < now) registry.delete(key)
  registry.set(id, { box, expires: now + ttlMs })
}

/** Claim and consume a published box, if one exists and has not expired. */
export function claimShared(id: string): Box | null {
  const entry = registry.get(id)
  if (entry === undefined) return null
  registry.delete(id) // consume-on-claim
  return entry.expires < Date.now() ? null : entry.box
}
