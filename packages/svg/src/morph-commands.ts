import { animatable, getSharedScheduler, type Scheduler } from '@underlying/core'
import { scalarControls } from './handle'
import type { Morph, MorphElement } from './morph'
import {
  align,
  collapseToPoint,
  isPointSubpath,
  lerpSubpath,
  parsePath,
  reconcile,
  subpathArea,
  subpathCentroid,
  subpathToD,
  type Subpath,
} from './path-commands'

/** The shape to morph toward: raw path data (`"M ..."`) or an element with a `d`. */
export type MorphCommandsTarget = string | { getAttribute(name: string): string | null }

export interface MorphCommandsOptions {
  scheduler?: Scheduler
  /** Initial morph fraction, 0..1 (0 = original shape, 1 = target). Default 0. */
  from?: number
  /** Spring to this fraction on creation. */
  to?: number
}

const dataOf = (target: MorphCommandsTarget): string =>
  typeof target === 'string' ? target : (target.getAttribute('d') ?? '')

/**
 * Pair from/to subpaths by SIMILARITY (centroid position + enclosed area) rather
 * than by index, so the parts of a multi-piece shape map to their nearest
 * counterpart. A greedy assignment over the normalized cost matrix; whichever side
 * has surplus subpaths, each unmatched one is paired with a collapsed point (its
 * own centroid) so it shrinks away (a surplus source) or grows in (a surplus target).
 */
const pairSubpaths = (fromSubs: Subpath[], toSubs: Subpath[]): Array<{ a: Subpath; b: Subpath }> => {
  // Extent of all anchors, to make centroid distance comparable to area ratio.
  const all = [...fromSubs, ...toSubs]
  const cents = new Map<Subpath, ReturnType<typeof subpathCentroid>>()
  const areas = new Map<Subpath, number>()
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const sp of all) {
    const c = subpathCentroid(sp)
    cents.set(sp, c)
    areas.set(sp, subpathArea(sp))
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x)
    maxY = Math.max(maxY, c.y)
  }
  const diag = Math.hypot(maxX - minX, maxY - minY) || 1

  const cost = (a: Subpath, b: Subpath): number => {
    const ca = cents.get(a) as { x: number; y: number }
    const cb = cents.get(b) as { x: number; y: number }
    const posCost = Math.hypot(ca.x - cb.x, ca.y - cb.y) / diag
    const areaA = areas.get(a) as number
    const areaB = areas.get(b) as number
    const areaCost = Math.abs(areaA - areaB) / (Math.max(areaA, areaB) || 1)
    return posCost + 0.5 * areaCost
  }

  // Greedy: take the cheapest available pair until one side is exhausted.
  const candidates: Array<{ i: number; j: number; c: number }> = []
  for (let i = 0; i < fromSubs.length; i += 1) {
    for (let j = 0; j < toSubs.length; j += 1) {
      candidates.push({ i, j, c: cost(fromSubs[i] as Subpath, toSubs[j] as Subpath) })
    }
  }
  candidates.sort((p, q) => p.c - q.c)
  const usedFrom = new Set<number>()
  const usedTo = new Set<number>()
  const pairs: Array<{ a: Subpath; b: Subpath }> = []
  for (const { i, j } of candidates) {
    if (usedFrom.has(i) || usedTo.has(j)) continue
    usedFrom.add(i)
    usedTo.add(j)
    const [a, b] = reconcile(fromSubs[i] as Subpath, toSubs[j] as Subpath)
    pairs.push({ a, b: align(a, b) })
  }
  // Surplus source subpaths collapse to their own point (shrink away at f=1).
  for (let i = 0; i < fromSubs.length; i += 1) {
    if (usedFrom.has(i)) continue
    const sp = fromSubs[i] as Subpath
    pairs.push({ a: sp, b: collapseToPoint(sp, subpathCentroid(sp)) })
  }
  // Surplus target subpaths grow from their own point (appear by f=1).
  for (let j = 0; j < toSubs.length; j += 1) {
    if (usedTo.has(j)) continue
    const sp = toSubs[j] as Subpath
    pairs.push({ a: collapseToPoint(sp, subpathCentroid(sp)), b: sp })
  }
  return pairs
}

/**
 * Command-preserving morph. Unlike `morph()` (which resamples both outlines into
 * a polyline), this parses both `d` strings into cubic segments, subdivides the
 * sparser shape so the two match anchor-for-anchor (de Casteljau, so original
 * corners stay sharp), aligns closed rings by rotation and winding, and
 * interpolates each anchor and control. The result is real curves with crisp
 * corners. Elliptical arcs (A) are converted to cubics; segments are divided by
 * arc length, correspondence is matched on centroid/scale-normalized anchors, and
 * subpaths pair by similarity (surplus pieces shrink to / grow from a point). The
 * fraction is a live Animatable - spring it, scrub it, grab it mid-morph.
 * `revert()` restores the original `d`. For arbitrary blobby shapes where corner
 * preservation does not matter, `morph()` (resampling) is the simpler fallback.
 */
export function morphCommands(element: MorphElement, target: MorphCommandsTarget, options: MorphCommandsOptions = {}): Morph {
  const originalD = element.getAttribute('d')
  const fromSubs = parsePath(originalD ?? '')
  const toSubs = parsePath(dataOf(target))

  // If one side is empty, hold the other in place so fraction 0 still reproduces
  // the original instead of blanking the element. Otherwise pair by similarity.
  let pairs: Array<{ a: Subpath; b: Subpath }>
  if (fromSubs.length === 0 || toSubs.length === 0) {
    const held = fromSubs.length === 0 ? toSubs : fromSubs
    pairs = held.map((sp) => reconcile(sp, sp)).map(([a, b]) => ({ a, b: align(a, b) }))
  } else {
    pairs = pairSubpaths(fromSubs, toSubs)
  }

  const scheduler = options.scheduler ?? getSharedScheduler()
  const fraction = animatable(
    options.from ?? 0,
    options.scheduler !== undefined ? { scheduler: options.scheduler } : undefined,
  )

  let dirty = false
  let cancelFlush: (() => void) | null = null

  const write = (): void => {
    const f = fraction.get()
    // A piece that has fully shrunk (or not yet grown) emits nothing, so a
    // collapsed subpath never paints a stroked dot and f=0 reproduces the source.
    const parts: string[] = []
    for (const { a, b } of pairs) {
      const sp = lerpSubpath(a, b, f)
      if (!isPointSubpath(sp)) parts.push(subpathToD(sp))
    }
    element.setAttribute('d', parts.join(' '))
  }
  const scheduleFlush = (): void => {
    if (cancelFlush !== null) return
    cancelFlush = scheduler.subscribe(() => {
      cancelFlush?.()
      cancelFlush = null
      if (dirty) {
        dirty = false
        write()
      }
    }, 'render')
  }

  const unsubscribe = fraction.on('change', () => {
    dirty = true
    scheduleFlush()
  })
  write()

  const revert = (): void => {
    fraction.stop()
    unsubscribe()
    cancelFlush?.()
    cancelFlush = null
    if (originalD !== null) element.setAttribute('d', originalD)
    fraction.dispose()
  }

  if (options.to !== undefined) fraction.spring(options.to)

  return { fraction, ...scalarControls(fraction, revert) }
}
