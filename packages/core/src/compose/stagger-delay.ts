import { resolveEasing, type EasingInput } from '../physics/easing-registry'

/**
 * A delay schedule: given an item's index and the total count, return its start
 * delay in ms. The shape stagger() and animate()'s `delay` option both consume.
 */
export type DelayFn = (index: number, total: number) => number

/** Where the wave begins. A number is a specific index (1D) or cell index (grid). */
export type StaggerOrigin = number | 'start' | 'end' | 'center' | 'edges' | 'random'

/** Restrict a grid wave to one axis (default: the diagonal Euclidean ripple). */
export type StaggerAxis = 'x' | 'y'

export interface StaggerGrid {
  readonly cols: number
  /** Defaults to ceil(total / cols). */
  readonly rows?: number
}

export interface StaggerDelayOptions {
  /** ms between adjacent items in the wave (default 0 - no wave). */
  each?: number
  /** Wave origin (default 'start'). */
  from?: StaggerOrigin
  /** A flat lead-in added to every delay, ms (default 0). */
  start?: number
  /** 2D propagation by cell distance; rows defaults to ceil(total / cols). */
  grid?: StaggerGrid
  /** Restrict a grid wave to one axis (grid only; ignored without a grid). */
  axis?: StaggerAxis
  /** Redistribute the normalized distance through an easing (default linear/identity). */
  ease?: EasingInput
  /** Deterministic 'random': a fixed default (1) is stable across reloads and tests. */
  seed?: number
}

// A small seeded PRNG so 'random' is deterministic: the same seed yields the
// same permutation across reloads, HMR, and two calls in a test.
const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// A seeded permutation rank: each index lands at a stable random position in
// [0, total). argsort the indices by a per-index random float.
const randomRanks = (total: number, seed: number): number[] => {
  const rng = mulberry32(seed)
  const order = Array.from({ length: total }, (_, i) => ({ i, r: rng() }))
  order.sort((a, b) => a.r - b.r)
  const ranks = new Array<number>(total)
  order.forEach((entry, position) => {
    ranks[entry.i] = position
  })
  return ranks
}

const rank1d = (i: number, last: number, from: Exclude<StaggerOrigin, 'random'>): number => {
  if (from === 'start') return i
  if (from === 'end') return last - i
  if (from === 'center') return Math.abs(i - last / 2)
  if (from === 'edges') return Math.min(i, last - i)
  // A specific index, clamped into range so an out-of-bounds origin still has an item at delay 0.
  return Math.abs(i - Math.min(Math.max(from, 0), last))
}

const gridOriginCell = (
  from: Exclude<StaggerOrigin, 'random' | 'edges'>,
  lastX: number,
  lastY: number,
  cols: number,
): { x: number; y: number } => {
  if (from === 'start') return { x: 0, y: 0 }
  if (from === 'end') return { x: lastX, y: lastY }
  if (from === 'center') return { x: lastX / 2, y: lastY / 2 }
  // A specific cell index, clamped into the grid.
  const cell = Math.min(Math.max(from, 0), lastX + lastY * cols)
  return { x: Math.min(cell % cols, lastX), y: Math.min(Math.floor(cell / cols), lastY) }
}

const gridRanks = (total: number, grid: StaggerGrid, from: Exclude<StaggerOrigin, 'random'>, axis: StaggerAxis | undefined): number[] => {
  // A non-positive column count has no valid geometry: fall back to a flat (no-wave) schedule.
  if (!(grid.cols >= 1)) return new Array<number>(total).fill(0)
  const cols = grid.cols
  const rows = grid.rows !== undefined && grid.rows >= 1 ? grid.rows : Math.ceil(total / cols)
  const lastX = cols - 1
  const lastY = rows - 1
  const ranks = new Array<number>(total)
  if (from === 'edges') {
    // Ripple inward from every edge: distance to the nearest edge.
    for (let i = 0; i < total; i++) {
      const cx = i % cols
      const cy = Math.floor(i / cols)
      const ex = Math.min(cx, lastX - cx)
      const ey = Math.min(cy, lastY - cy)
      ranks[i] = axis === 'x' ? ex : axis === 'y' ? ey : Math.min(ex, ey)
    }
    return ranks
  }
  const origin = gridOriginCell(from, lastX, lastY, cols)
  for (let i = 0; i < total; i++) {
    const dx = Math.abs((i % cols) - origin.x)
    const dy = Math.abs(Math.floor(i / cols) - origin.y)
    ranks[i] = axis === 'x' ? dx : axis === 'y' ? dy : Math.hypot(dx, dy)
  }
  return ranks
}

const computeRanks = (total: number, options: StaggerDelayOptions): number[] => {
  const from = options.from ?? 'start'
  if (from === 'random') return randomRanks(total, options.seed ?? 1)
  if (options.grid !== undefined) return gridRanks(total, options.grid, from, options.axis)
  const last = total - 1
  const ranks = new Array<number>(total)
  for (let i = 0; i < total; i++) ranks[i] = rank1d(i, last, from)
  return ranks
}

/**
 * Build a delay schedule for a staggered set. The normalized distance of each
 * item from the wave origin is run through `ease` and scaled by `each`, so:
 *
 *   delay(i) = start + ease(rank(i) / maxRank) * (maxRank * each)
 *
 * With defaults (just `each`, from 'start', identity ease, no grid) this is
 * exactly `each * i` - byte-identical to the original linear stagger. Choose the
 * origin (start/end/center/edges/random/a specific index), propagate across a 2D
 * grid by cell distance, restrict to an axis, and redistribute with an easing.
 * Pure: no DOM, no globals. The per-total rank computation is memoized so a
 * single staggered call computes it once.
 */
export function staggerDelay(options: StaggerDelayOptions = {}): DelayFn {
  const each = options.each ?? 0
  const start = options.start ?? 0
  const ease = options.ease !== undefined ? resolveEasing(options.ease) : null

  let cache: { total: number; ranks: number[]; max: number } | null = null
  const ranksFor = (total: number): { ranks: number[]; max: number } => {
    if (cache !== null && cache.total === total) return cache
    const ranks = computeRanks(total, options)
    let max = 0
    for (const rank of ranks) if (rank > max) max = rank
    cache = { total, ranks, max }
    return cache
  }

  return (index, total) => {
    if (total <= 1 || each === 0) return start
    const { ranks, max } = ranksFor(total)
    const rank = ranks[index] ?? 0
    const t = max === 0 ? 0 : rank / max
    const eased = ease !== null ? ease(t) : t
    return start + eased * (max * each)
  }
}

/** The eager array form: every item's delay up front. One builder reused per item. */
export function staggerDelays(total: number, options: StaggerDelayOptions = {}): number[] {
  const fn = staggerDelay(options)
  return Array.from({ length: total }, (_, i) => fn(i, total))
}
