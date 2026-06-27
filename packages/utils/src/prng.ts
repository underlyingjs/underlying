// A tiny seeded PRNG (mulberry32). Deterministic: the same seed yields the same
// sequence, so a seeded ease (rough) draws the same curve on every run and is
// stable across SSR render and client hydration. Not for cryptography.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
