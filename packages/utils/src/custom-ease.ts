import type { Easing } from '@underlying/core'
import { parsePath, sampleCubics, samplesToEasing, type CurvePoint } from './curve'

export type EasePoint = readonly [number, number]

/**
 * Build an easing from a design-tool curve: an SVG-path string (e.g.
 * `'M0,0 C0.4,0 0.2,1 1,1'`, multi-segment ok) OR an array of `[x, y]` points -
 * used verbatim. Both are normalized so the first/last anchor become 0 and 1 on
 * each axis (any artboard size or SVG y-down works), then sampled and inverted.
 * DOM-free. For a single exact cubic, prefer `cubicBezier` (analytic, no LUT).
 */
export function customEase(source: string | ReadonlyArray<EasePoint>): Easing {
  const raw: CurvePoint[] =
    typeof source === 'string' ? sampleCubics(parsePath(source)) : source.map(([x, y]) => ({ x, y }))
  if (raw.length < 2) return (p) => p

  const x0 = raw[0]!.x
  const y0 = raw[0]!.y
  const xSpan = raw[raw.length - 1]!.x - x0
  const ySpan = raw[raw.length - 1]!.y - y0
  if (xSpan === 0 || ySpan === 0) return (p) => p // degenerate flat curve

  const norm = raw.map((p) => ({ x: (p.x - x0) / xSpan, y: (p.y - y0) / ySpan }))
  norm[0] = { x: 0, y: 0 }
  norm[norm.length - 1] = { x: 1, y: 1 }
  const ease = samplesToEasing(norm, { interpolation: 'linear' })
  return (progress) => (progress <= 0 ? 0 : progress >= 1 ? 1 : ease(progress))
}

/**
 * A cubic-bezier easing, exactly like CSS `cubic-bezier(x1, y1, x2, y2)` - paste
 * the four numbers from any easing visualiser or design tool. Solves x -> t with
 * Newton-Raphson (bisection fallback), then reads y.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  if (x1 === y1 && x2 === y2) return (t) => t // the line y = x

  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t
  const sampleSlope = (t: number): number => (3 * ax * t + 2 * bx) * t + cx

  const solveForT = (x: number): number => {
    let t = x
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x
      if (Math.abs(error) < 1e-6) return t
      const slope = sampleSlope(t)
      if (Math.abs(slope) < 1e-6) break
      t -= error / slope
    }
    let lo = 0
    let hi = 1
    t = x
    while (lo < hi) {
      const value = sampleX(t)
      if (Math.abs(value - x) < 1e-6) return t
      if (x > value) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return t
  }

  return (progress) => (progress <= 0 ? 0 : progress >= 1 ? 1 : sampleY(solveForT(progress)))
}
