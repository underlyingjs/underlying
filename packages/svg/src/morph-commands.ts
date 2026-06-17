import { animatable, getSharedScheduler, type Scheduler } from '@underlying/core'
import { scalarControls } from './handle'
import type { Morph, MorphElement } from './morph'
import { align, lerpSubpath, parsePath, reconcile, subpathToD, type Subpath } from './path-commands'

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
 * Command-preserving morph. Unlike `morph()` (which resamples both outlines into
 * a polyline), this parses both `d` strings into cubic segments, subdivides the
 * sparser shape so the two match anchor-for-anchor (de Casteljau, so original
 * corners stay sharp), aligns closed rings by rotation and winding, and
 * interpolates each anchor and control. The result is real curves with crisp
 * corners. The fraction is a live Animatable - spring it, scrub it, grab it
 * mid-morph. `revert()` restores the original `d`. Arcs (A) are not supported;
 * use `morph()` for arc paths or arbitrary shapes.
 */
export function morphCommands(element: MorphElement, target: MorphCommandsTarget, options: MorphCommandsOptions = {}): Morph {
  const originalD = element.getAttribute('d')
  const fromSubs = parsePath(originalD ?? '')
  const toSubs = parsePath(dataOf(target))

  // Pair subpaths by index (padding the shorter with its last), reconcile the
  // segment counts, and align each closed pair.
  const pairs: Array<{ a: Subpath; b: Subpath }> = []
  const count = Math.max(fromSubs.length, toSubs.length)
  for (let i = 0; i < count; i += 1) {
    const fromSub = fromSubs[i] ?? fromSubs[fromSubs.length - 1]
    const toSub = toSubs[i] ?? toSubs[toSubs.length - 1]
    // If one side is empty, hold the other in place so fraction 0 still
    // reproduces the original instead of blanking the element.
    const rawA = fromSub ?? toSub
    const rawB = toSub ?? fromSub
    if (rawA === undefined || rawB === undefined) continue
    const [a, b] = reconcile(rawA, rawB)
    pairs.push({ a, b: align(a, b) })
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
    element.setAttribute('d', pairs.map(({ a, b }) => subpathToD(lerpSubpath(a, b, f))).join(' '))
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
