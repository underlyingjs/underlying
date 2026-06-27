import type { Easing } from '@underlying/core'

// The shared, DOM-free curve engine: turn sampled (x, y) points into an Easing,
// and parse an SVG-path string into cubic segments to sample. Used by customEase
// (path / points) and rough (seeded noise). Not re-exported from the package.

export interface CurvePoint {
  readonly x: number
  readonly y: number
}

export interface SampleOptions {
  /** 'linear' lerps between samples; 'step' holds each sample (a glitch staircase). */
  interpolation?: 'linear' | 'step'
}

const warned = new Set<string>()
const warnOnce = (key: string, message: string): void => {
  if (warned.has(key)) return
  warned.add(key)
  if (typeof console !== 'undefined') console.warn(`[underlying] ${message}`)
}

/**
 * Build an Easing from sampled points: map progress across the x-range, binary-search
 * the bracketing samples, and read y (held or lerped). progress <= 0 / >= 1 return the
 * first / last y, so a caller that pins those samples to 0 and 1 lands exactly.
 */
export function samplesToEasing(points: ReadonlyArray<CurvePoint>, options: SampleOptions = {}): Easing {
  const step = options.interpolation === 'step'
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const n = sorted.length
  if (n === 0) return (p) => p
  const xs = sorted.map((p) => p.x)
  const ys = sorted.map((p) => p.y)
  const x0 = xs[0]!
  const span = xs[n - 1]! - x0
  return (progress) => {
    if (progress <= 0 || n === 1) return ys[0]!
    if (progress >= 1) return ys[n - 1]!
    const x = x0 + progress * span
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (xs[mid]! <= x) lo = mid
      else hi = mid - 1
    }
    if (step || lo >= n - 1) return ys[lo]!
    const xa = xs[lo]!
    const xb = xs[lo + 1]!
    const t = xb === xa ? 0 : (x - xa) / (xb - xa)
    return ys[lo]! + (ys[lo + 1]! - ys[lo]!) * t
  }
}

type Pt = readonly [number, number]
interface Cubic {
  p0: Pt
  p1: Pt
  p2: Pt
  p3: Pt
}

const lineCubic = (x0: number, y0: number, x1: number, y1: number): Cubic => ({
  p0: [x0, y0],
  p1: [x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3],
  p2: [x0 + (2 * (x1 - x0)) / 3, y0 + (2 * (y1 - y0)) / 3],
  p3: [x1, y1],
})

/**
 * Parse an SVG-path string into cubic segments, DOM-free (a regex tokenizer, never
 * SVGPathElement). Supports M/L/H/V/C/S/Q/T (+ their relative forms) and Z; arcs (A)
 * warn once and stop. Relative commands accumulate from the current point.
 */
export function parsePath(d: string): Cubic[] {
  const tokens = d.match(/([mlhvcsqtz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/gi) ?? []
  const cubics: Cubic[] = []
  let i = 0
  let cx = 0
  let cy = 0 // current point
  let sx = 0
  let sy = 0 // subpath start
  let px = 0
  let py = 0 // previous control, for S/T reflection
  let lastCtrl = 'n' // family of that control: 'c'ubic, 'q'uad, or 'n'one - S reflects only after C/S, T only after Q/T
  let cmd = ''
  const num = (): number => Number(tokens[i++])
  const isCmd = (t: string): boolean => /^[a-z]$/i.test(t)

  while (i < tokens.length) {
    const before = i
    if (isCmd(tokens[i]!)) {
      cmd = tokens[i]!
      i++
    }
    const rel = cmd === cmd.toLowerCase()
    const ox = rel ? cx : 0
    const oy = rel ? cy : 0
    switch (cmd.toUpperCase()) {
      case 'M': {
        cx = ox + num()
        cy = oy + num()
        sx = cx
        sy = cy
        px = cx
        py = cy
        lastCtrl = 'n'
        cmd = rel ? 'l' : 'L' // implicit coords after a moveto are linetos
        break
      }
      case 'L': {
        const x = ox + num()
        const y = oy + num()
        cubics.push(lineCubic(cx, cy, x, y))
        cx = x
        cy = y
        px = cx
        py = cy
        lastCtrl = 'n'
        break
      }
      case 'H': {
        const x = ox + num()
        cubics.push(lineCubic(cx, cy, x, cy))
        cx = x
        px = cx
        py = cy
        lastCtrl = 'n'
        break
      }
      case 'V': {
        const y = oy + num()
        cubics.push(lineCubic(cx, cy, cx, y))
        cy = y
        px = cx
        py = cy
        lastCtrl = 'n'
        break
      }
      case 'C': {
        const x1 = ox + num()
        const y1 = oy + num()
        const x2 = ox + num()
        const y2 = oy + num()
        const x3 = ox + num()
        const y3 = oy + num()
        cubics.push({ p0: [cx, cy], p1: [x1, y1], p2: [x2, y2], p3: [x3, y3] })
        cx = x3
        cy = y3
        px = x2
        py = y2
        lastCtrl = 'c'
        break
      }
      case 'S': {
        // The reflected control is defined only after C/S; otherwise it is the current point.
        const reflect = lastCtrl === 'c'
        const x1 = reflect ? 2 * cx - px : cx
        const y1 = reflect ? 2 * cy - py : cy
        const x2 = ox + num()
        const y2 = oy + num()
        const x3 = ox + num()
        const y3 = oy + num()
        cubics.push({ p0: [cx, cy], p1: [x1, y1], p2: [x2, y2], p3: [x3, y3] })
        cx = x3
        cy = y3
        px = x2
        py = y2
        lastCtrl = 'c'
        break
      }
      case 'Q': {
        const qx = ox + num()
        const qy = oy + num()
        const x3 = ox + num()
        const y3 = oy + num()
        cubics.push({
          p0: [cx, cy],
          p1: [cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)],
          p2: [x3 + (2 / 3) * (qx - x3), y3 + (2 / 3) * (qy - y3)],
          p3: [x3, y3],
        })
        cx = x3
        cy = y3
        px = qx
        py = qy
        lastCtrl = 'q'
        break
      }
      case 'T': {
        // The reflected control is defined only after Q/T; otherwise it is the current point.
        const reflect = lastCtrl === 'q'
        const qx = reflect ? 2 * cx - px : cx
        const qy = reflect ? 2 * cy - py : cy
        const x3 = ox + num()
        const y3 = oy + num()
        cubics.push({
          p0: [cx, cy],
          p1: [cx + (2 / 3) * (qx - cx), cy + (2 / 3) * (qy - cy)],
          p2: [x3 + (2 / 3) * (qx - x3), y3 + (2 / 3) * (qy - y3)],
          p3: [x3, y3],
        })
        cx = x3
        cy = y3
        px = qx
        py = qy
        lastCtrl = 'q'
        break
      }
      case 'Z': {
        cx = sx
        cy = sy
        px = cx
        py = cy
        lastCtrl = 'n'
        break
      }
      default: {
        warnOnce('customEase:cmd', `customEase: unsupported path command "${cmd}" - stopping early`)
        return cubics
      }
    }
    // Z consumes no token; a stray number after it would spin the loop forever - stop instead.
    if (i === before) break
  }
  return cubics
}

/** Flatten cubic segments to (x, y) samples by evaluating the Bernstein form. */
export function sampleCubics(cubics: ReadonlyArray<Cubic>, total = 256): CurvePoint[] {
  if (cubics.length === 0) return []
  const per = Math.max(2, Math.floor(total / cubics.length))
  const points: CurvePoint[] = []
  cubics.forEach((c, ci) => {
    for (let s = ci === 0 ? 0 : 1; s <= per; s++) {
      const t = s / per
      const mt = 1 - t
      const a = mt * mt * mt
      const b = 3 * mt * mt * t
      const cc = 3 * mt * t * t
      const dd = t * t * t
      points.push({
        x: a * c.p0[0] + b * c.p1[0] + cc * c.p2[0] + dd * c.p3[0],
        y: a * c.p0[1] + b * c.p1[1] + cc * c.p2[1] + dd * c.p3[1],
      })
    }
  })
  return points
}
