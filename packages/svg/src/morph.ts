import { animatable, getSharedScheduler, type Animatable, type Scheduler } from '@underlying/core'
import type { PathGeometry } from './geometry'
import { scalarControls, type ScalarControls } from './handle'

/** A path element whose shape this package rewrites: geometry plus the `d` attribute. */
export interface MorphElement extends PathGeometry {
  getAttribute(name: string): string | null
  setAttribute(name: string, value: string): void
}

/** The shape to morph toward: raw path data (`"M ..."`) or any geometry/element. */
export type MorphTarget = string | PathGeometry

export interface MorphOptions {
  scheduler?: Scheduler
  /** Points sampled along each outline; more is smoother (and heavier). Default 64. */
  samples?: number
  /** Close the interpolated outline - for closed shapes (a star, a blob). */
  closed?: boolean
  /** Initial morph fraction, 0..1 (0 = original shape, 1 = target). Default 0. */
  from?: number
  /** Spring to this fraction on creation. */
  to?: number
}

interface Point {
  x: number
  y: number
}

const round = (n: number): number => Math.round(n * 100) / 100

// Resample an outline into `count` points evenly spaced by arc length. This is
// what lets ANY two shapes morph: both become the same-length point list, no
// matching of bezier commands required.
const samplePoints = (geometry: PathGeometry, count: number): Point[] => {
  const length = geometry.getTotalLength()
  const divisor = count > 1 ? count - 1 : 1
  const points: Point[] = []
  for (let i = 0; i < count; i += 1) {
    const p = geometry.getPointAtLength((i / divisor) * length)
    points.push({ x: p.x, y: p.y })
  }
  return points
}

const toPathData = (points: Point[], closed: boolean): string => {
  const first = points[0]
  if (first === undefined) return ''
  let d = `M ${round(first.x)} ${round(first.y)}`
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i]
    if (p !== undefined) d += ` L ${round(p.x)} ${round(p.y)}`
  }
  return closed ? `${d} Z` : d
}

const targetGeometry = (target: MorphTarget): PathGeometry => {
  if (typeof target !== 'string') return target
  if (typeof document === 'undefined') {
    throw new Error('@underlying/svg: morph target path data needs a DOM')
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', target)
  return path as unknown as PathGeometry
}

export interface Morph extends ScalarControls {
  /** The live 0..1 morph fraction (0 original, 1 target). Compose it anywhere. */
  readonly fraction: Animatable
}

/**
 * Morph one path into another, physics-first. Both outlines are resampled into
 * `samples` points along their length and interpolated, so any two shapes morph
 * (no matching command structure needed). The fraction is a live Animatable -
 * spring it, scrub it, or grab it mid-morph. `revert()` restores the original `d`.
 */
export function morph(element: MorphElement, target: MorphTarget, options: MorphOptions = {}): Morph {
  const count = Math.max(2, options.samples ?? 64)
  const closed = options.closed ?? false
  const fromPoints = samplePoints(element, count)
  const toPoints = samplePoints(targetGeometry(target), count)
  const originalD = element.getAttribute('d')

  const scheduler = options.scheduler ?? getSharedScheduler()
  const fraction = animatable(
    options.from ?? 0,
    options.scheduler !== undefined ? { scheduler: options.scheduler } : undefined,
  )

  let dirty = false
  let cancelFlush: (() => void) | null = null

  const write = (): void => {
    const f = fraction.get()
    const blended: Point[] = []
    for (let i = 0; i < count; i += 1) {
      const a = fromPoints[i]
      const b = toPoints[i]
      if (a === undefined || b === undefined) continue
      blended.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
    }
    element.setAttribute('d', toPathData(blended, closed))
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
