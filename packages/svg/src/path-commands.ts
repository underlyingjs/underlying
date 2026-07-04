// Command-preserving morph geometry: parse a `d` string into absolute cubic
// segments, reconcile two shapes to the same segment count by de Casteljau
// subdivision (so original anchors - sharp corners - stay anchors), and
// interpolate per anchor/control. No getPointAtLength: the curves and corners
// survive instead of being resampled into a polyline.

export interface Pt {
  readonly x: number
  readonly y: number
}

/** One cubic bezier from the previous anchor: two controls and the end anchor. */
export interface Cubic {
  readonly c1: Pt
  readonly c2: Pt
  readonly end: Pt
}

/** A subpath: a start anchor, a chain of cubics, and whether it closes. */
export interface Subpath {
  readonly start: Pt
  readonly segments: Cubic[]
  readonly closed: boolean
}

const round = (n: number): number => Math.round(n * 1000) / 1000
const lerp = (a: number, b: number, f: number): number => a + (b - a) * f
const lerpPt = (a: Pt, b: Pt, f: number): Pt => ({ x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) })

// A straight line as a cubic: controls at the third points, so it stays exactly
// straight and a corner (anchor) remains an anchor.
const lineCubic = (from: Pt, to: Pt): Cubic => ({
  c1: { x: from.x + (to.x - from.x) / 3, y: from.y + (to.y - from.y) / 3 },
  c2: { x: from.x + (2 * (to.x - from.x)) / 3, y: from.y + (2 * (to.y - from.y)) / 3 },
  end: to,
})

// Quadratic -> cubic (degree elevation): exact, no shape change.
const quadCubic = (from: Pt, control: Pt, to: Pt): Cubic => ({
  c1: { x: from.x + (2 * (control.x - from.x)) / 3, y: from.y + (2 * (control.y - from.y)) / 3 },
  c2: { x: to.x + (2 * (control.x - to.x)) / 3, y: to.y + (2 * (control.y - to.y)) / 3 },
  end: to,
})

const reflect = (point: Pt, about: Pt): Pt => ({ x: 2 * about.x - point.x, y: 2 * about.y - point.y })

const NUMBER = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g
const COMMAND = /([astvzqmhlcASTVZQMHLC])([^astvzqmhlcASTVZQMHLC]*)/g

// One arc arg group: rx ry x-rotation, then two single-digit flags (which may be
// glued to their neighbours, e.g. "0 0110 10"), then the end point. The [01]
// slots consume exactly one digit each, so packed flags parse correctly.
const N = String.raw`[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?`
const ARC_ARGS = new RegExp(
  `(${N})[\\s,]*(${N})[\\s,]*(${N})[\\s,]*([01])[\\s,]*([01])[\\s,]*(${N})[\\s,]*(${N})`,
  'g',
)

/**
 * Convert one elliptical arc (endpoint parameterization) to a chain of cubic
 * beziers. Endpoint -> center per the SVG spec, then split into <=90 degree
 * sweeps each approximated by a cubic (the standard 4/3 tan(dθ/4) control offset).
 * Degenerate radii or a zero-length arc fall back to a straight line.
 */
const arcToCubics = (
  from: Pt,
  rxIn: number,
  ryIn: number,
  phiDeg: number,
  largeArc: boolean,
  sweep: boolean,
  to: Pt,
): Cubic[] => {
  if (rxIn === 0 || ryIn === 0 || (from.x === to.x && from.y === to.y)) return [lineCubic(from, to)]
  let rx = Math.abs(rxIn)
  let ry = Math.abs(ryIn)
  const phi = (phiDeg * Math.PI) / 180
  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)

  // Step 1: transform to the ellipse's coordinate frame (endpoint delta halved).
  const dx = (from.x - to.x) / 2
  const dy = (from.y - to.y) / 2
  const x1p = cosP * dx + sinP * dy
  const y1p = -sinP * dx + cosP * dy

  // Step 2: correct out-of-range radii so the ellipse can span the endpoints.
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }

  // Step 3: the center in the ellipse frame.
  const rx2 = rx * rx
  const ry2 = ry * ry
  const num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p
  const co = (largeArc !== sweep ? 1 : -1) * Math.sqrt(Math.max(0, num / den))
  const cxp = (co * rx * y1p) / ry
  const cyp = (-co * ry * x1p) / rx

  // Step 4: back to the user frame, and the start/sweep angles.
  const cx = cosP * cxp - sinP * cyp + (from.x + to.x) / 2
  const cy = sinP * cxp + cosP * cyp + (from.y + to.y) / 2
  const angle = (ux: number, uy: number, vx: number, vy: number): number => {
    const dot = ux * vx + uy * vy
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy))
    let a = Math.acos(Math.min(1, Math.max(-1, dot / (len || 1))))
    if (ux * vy - uy * vx < 0) a = -a
    return a
  }
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dtheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI
  if (sweep && dtheta < 0) dtheta += 2 * Math.PI

  // Step 5: one cubic per <=90 degree segment.
  const count = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)))
  const delta = dtheta / count
  const alpha = (4 / 3) * Math.tan(delta / 4)
  const cubics: Cubic[] = []
  let t = theta1
  let px = from.x
  let py = from.y
  for (let i = 0; i < count; i += 1) {
    const t2 = t + delta
    const cosT = Math.cos(t)
    const sinT = Math.sin(t)
    const cosT2 = Math.cos(t2)
    const sinT2 = Math.sin(t2)
    // Ellipse point at t2 (in the user frame).
    const ex = cx + rx * cosP * cosT2 - ry * sinP * sinT2
    const ey = cy + rx * sinP * cosT2 + ry * cosP * sinT2
    // Tangent-scaled control points via alpha.
    const d1x = -rx * cosP * sinT - ry * sinP * cosT
    const d1y = -rx * sinP * sinT + ry * cosP * cosT
    const d2x = -rx * cosP * sinT2 - ry * sinP * cosT2
    const d2y = -rx * sinP * sinT2 + ry * cosP * cosT2
    cubics.push({
      c1: { x: px + alpha * d1x, y: py + alpha * d1y },
      c2: { x: ex - alpha * d2x, y: ey - alpha * d2y },
      end: { x: ex, y: ey },
    })
    t = t2
    px = ex
    py = ey
  }
  return cubics
}

/**
 * Parse a `d` string into subpaths of absolute cubic segments. Handles M, L, H,
 * V, C, S, Q, T, A, Z (and their relative forms). Elliptical arcs (A/a) are
 * converted to cubic beziers (<=90 degrees per segment).
 */
export function parsePath(d: string): Subpath[] {
  const subpaths: Subpath[] = []
  let segments: Cubic[] = []
  let start: Pt = { x: 0, y: 0 }
  let cur: Pt = { x: 0, y: 0 }
  let prevCubicCtrl: Pt | null = null // last C/S second control, for S reflection
  let prevQuadCtrl: Pt | null = null // last Q/T control, for T reflection
  let open = false

  const flush = (closed: boolean): void => {
    if (open && segments.length > 0) subpaths.push({ start, segments, closed }) // drop empty moveto-only legs
    segments = []
    open = false
  }
  // A drawing command after Z (with no explicit M) starts a new subpath at the
  // just-closed start point, which Z left in `cur`.
  const ensureOpen = (): void => {
    if (!open) {
      open = true
      start = cur
    }
  }

  let match: RegExpExecArray | null
  COMMAND.lastIndex = 0
  while ((match = COMMAND.exec(d)) !== null) {
    const code = match[1] as string
    const nums = (match[2]?.match(NUMBER) ?? []).map(Number)
    const rel = code === code.toLowerCase()
    const upper = code.toUpperCase()
    const ax = (v: number): number => (rel ? cur.x + v : v)
    const ay = (v: number): number => (rel ? cur.y + v : v)
    let i = 0
    if (upper !== 'M' && upper !== 'Z') ensureOpen() // continue a new subpath after Z

    if (upper === 'M') {
      flush(false)
      start = cur = { x: ax(nums[0] ?? 0), y: ay(nums[1] ?? 0) }
      open = true
      prevCubicCtrl = prevQuadCtrl = null
      i = 2
      // extra coordinate pairs after an M are implicit L
      for (; i + 1 < nums.length; i += 2) {
        const to = { x: ax(nums[i] ?? 0), y: ay(nums[i + 1] ?? 0) }
        segments.push(lineCubic(cur, to))
        cur = to
      }
      prevCubicCtrl = prevQuadCtrl = null
    } else if (upper === 'Z') {
      if (open) segments.push(lineCubic(cur, start)) // close with a straight segment if needed
      flush(true)
      cur = start
      prevCubicCtrl = prevQuadCtrl = null
    } else if (upper === 'L') {
      for (; i + 1 < nums.length; i += 2) {
        const to = { x: ax(nums[i] ?? 0), y: ay(nums[i + 1] ?? 0) }
        segments.push(lineCubic(cur, to))
        cur = to
      }
      prevCubicCtrl = prevQuadCtrl = null
    } else if (upper === 'H') {
      for (; i < nums.length; i += 1) {
        const to = { x: ax(nums[i] ?? 0), y: cur.y }
        segments.push(lineCubic(cur, to))
        cur = to
      }
      prevCubicCtrl = prevQuadCtrl = null
    } else if (upper === 'V') {
      for (; i < nums.length; i += 1) {
        const to = { x: cur.x, y: ay(nums[i] ?? 0) }
        segments.push(lineCubic(cur, to))
        cur = to
      }
      prevCubicCtrl = prevQuadCtrl = null
    } else if (upper === 'C') {
      for (; i + 5 < nums.length; i += 6) {
        const c1 = { x: ax(nums[i] ?? 0), y: ay(nums[i + 1] ?? 0) }
        const c2 = { x: ax(nums[i + 2] ?? 0), y: ay(nums[i + 3] ?? 0) }
        const end = { x: ax(nums[i + 4] ?? 0), y: ay(nums[i + 5] ?? 0) }
        segments.push({ c1, c2, end })
        cur = end
        prevCubicCtrl = c2
      }
      prevQuadCtrl = null
    } else if (upper === 'S') {
      for (; i + 3 < nums.length; i += 4) {
        const c1 = prevCubicCtrl !== null ? reflect(prevCubicCtrl, cur) : cur
        const c2 = { x: ax(nums[i] ?? 0), y: ay(nums[i + 1] ?? 0) }
        const end = { x: ax(nums[i + 2] ?? 0), y: ay(nums[i + 3] ?? 0) }
        segments.push({ c1, c2, end })
        cur = end
        prevCubicCtrl = c2
      }
      prevQuadCtrl = null
    } else if (upper === 'Q') {
      for (; i + 3 < nums.length; i += 4) {
        const ctrl = { x: ax(nums[i] ?? 0), y: ay(nums[i + 1] ?? 0) }
        const end = { x: ax(nums[i + 2] ?? 0), y: ay(nums[i + 3] ?? 0) }
        segments.push(quadCubic(cur, ctrl, end))
        cur = end
        prevQuadCtrl = ctrl
      }
      prevCubicCtrl = null
    } else if (upper === 'T') {
      for (; i + 1 < nums.length; i += 2) {
        const ctrl: Pt = prevQuadCtrl !== null ? reflect(prevQuadCtrl, cur) : cur
        const end = { x: ax(nums[i] ?? 0), y: ay(nums[i + 1] ?? 0) }
        segments.push(quadCubic(cur, ctrl, end))
        cur = end
        prevQuadCtrl = ctrl
      }
      prevCubicCtrl = null
    } else if (upper === 'A') {
      // Arc args need a flag-aware tokenizer (flags may be glued to neighbours),
      // so re-scan the raw arg substring rather than the generic NUMBER split.
      const rawArgs = match[2] ?? ''
      ARC_ARGS.lastIndex = 0
      let arc: RegExpExecArray | null
      while ((arc = ARC_ARGS.exec(rawArgs)) !== null) {
        const rx = Number(arc[1])
        const ry = Number(arc[2])
        const rot = Number(arc[3])
        const largeArc = arc[4] === '1'
        const sweep = arc[5] === '1'
        const end = { x: ax(Number(arc[6])), y: ay(Number(arc[7])) }
        for (const cubic of arcToCubics(cur, rx, ry, rot, largeArc, sweep, end)) segments.push(cubic)
        cur = end
      }
      prevCubicCtrl = prevQuadCtrl = null
    }
  }
  flush(false)
  return subpaths
}

// Point on a cubic at t (de Casteljau) - used to measure arc length.
const cubicPointAt = (p0: Pt, cubic: Cubic, t: number): Pt => {
  const a = lerpPt(p0, cubic.c1, t)
  const b = lerpPt(cubic.c1, cubic.c2, t)
  const c = lerpPt(cubic.c2, cubic.end, t)
  const d = lerpPt(a, b, t)
  const e = lerpPt(b, c, t)
  return lerpPt(d, e, t)
}

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y)

const ARC_SAMPLES = 24

// Approximate arc length by flattening into samples (chord sum). A curve that
// folds back has a long arc but a short chord - measuring the arc divides it fairly.
const cubicArcLength = (from: Pt, cubic: Cubic): number => {
  let len = 0
  let prev = from
  for (let i = 1; i <= ARC_SAMPLES; i += 1) {
    const p = cubicPointAt(from, cubic, i / ARC_SAMPLES)
    len += dist(prev, p)
    prev = p
  }
  return len
}

// The t that bisects a cubic by ARC LENGTH (not the parametric midpoint), so a new
// anchor lands at the geometric middle of the curve.
const tAtHalfArcLength = (from: Pt, cubic: Cubic): number => {
  const cum: number[] = [0]
  let len = 0
  let prev = from
  for (let i = 1; i <= ARC_SAMPLES; i += 1) {
    const p = cubicPointAt(from, cubic, i / ARC_SAMPLES)
    len += dist(prev, p)
    cum.push(len)
    prev = p
  }
  const half = len / 2
  for (let i = 1; i <= ARC_SAMPLES; i += 1) {
    if ((cum[i] as number) >= half) {
      const seg = (cum[i] as number) - (cum[i - 1] as number)
      const frac = seg > 0 ? (half - (cum[i - 1] as number)) / seg : 0
      return (i - 1 + frac) / ARC_SAMPLES
    }
  }
  return 0.5
}

// Split one cubic at t into two cubics that trace the same curve (de Casteljau).
const splitCubic = (from: Pt, cubic: Cubic, t: number): [Cubic, Cubic] => {
  const p0 = from
  const p1 = cubic.c1
  const p2 = cubic.c2
  const p3 = cubic.end
  const a = lerpPt(p0, p1, t)
  const b = lerpPt(p1, p2, t)
  const c = lerpPt(p2, p3, t)
  const d = lerpPt(a, b, t)
  const e = lerpPt(b, c, t)
  const mid = lerpPt(d, e, t)
  return [
    { c1: a, c2: d, end: mid },
    { c1: e, c2: c, end: p3 },
  ]
}

// Bring a subpath up to `count` segments by repeatedly splitting its longest
// (by ARC LENGTH) segment at its arc-length midpoint. Original anchors are kept;
// new anchors land ON the curves at their geometric middle, so a curvy segment is
// divided fairly (a chord metric under-divides folds) while corners stay corners.
const subdivideTo = (subpath: Subpath, count: number): Subpath => {
  if (subpath.segments.length >= count) return subpath
  const segments = subpath.segments.slice()
  const anchorsBefore: Pt[] = [subpath.start]
  for (const seg of segments) anchorsBefore.push(seg.end)

  while (segments.length < count) {
    let longest = 0
    let best = -1
    for (let s = 0; s < segments.length; s += 1) {
      const arc = cubicArcLength(anchorsBefore[s] as Pt, segments[s] as Cubic)
      if (arc > longest) {
        longest = arc
        best = s
      }
    }
    // Every segment is zero-length (a point-like subpath grown to `count`): keep
    // splitting index 0 at the parametric midpoint so the count still reaches
    // `count` and the loop terminates.
    if (best < 0) best = 0
    const from = anchorsBefore[best] as Pt
    const seg = segments[best] as Cubic
    const t = longest > 0 ? tAtHalfArcLength(from, seg) : 0.5
    const [left, right] = splitCubic(from, seg, t)
    segments.splice(best, 1, left, right)
    anchorsBefore.splice(best + 1, 0, left.end)
  }
  return { start: subpath.start, segments, closed: subpath.closed }
}

/** Reconcile two subpaths to the same segment count (subdivide the smaller). */
export function reconcile(a: Subpath, b: Subpath): [Subpath, Subpath] {
  const count = Math.max(a.segments.length, b.segments.length)
  return [subdivideTo(a, count), subdivideTo(b, count)]
}

// The N ring anchors of a subpath (start + each segment end but the closing one).
const ringAnchors = (sp: Subpath): Pt[] => {
  const anchors: Pt[] = [sp.start]
  const upto = sp.closed ? sp.segments.length - 1 : sp.segments.length
  for (let i = 0; i < upto; i += 1) anchors.push((sp.segments[i] as Cubic).end)
  return anchors
}

/** The centroid of a point set (mean position). */
const centroid = (pts: Pt[]): Pt => {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p.x
    y += p.y
  }
  const n = pts.length || 1
  return { x: x / n, y: y / n }
}

// Center at the centroid and scale to unit RMS radius, so a correspondence cost
// measures rotational/winding match independent of the shapes' size and position.
const normalizeAnchors = (pts: Pt[]): Pt[] => {
  const c = centroid(pts)
  let sum = 0
  for (const p of pts) sum += (p.x - c.x) ** 2 + (p.y - c.y) ** 2
  const scale = Math.sqrt(sum / (pts.length || 1)) || 1
  return pts.map((p) => ({ x: (p.x - c.x) / scale, y: (p.y - c.y) / scale }))
}

// Reverse traversal: each cubic flips (controls swapped, direction reversed) and
// the segment order reverses. Used to match opposite winding.
const reverseSubpath = (sp: Subpath): Subpath => {
  const segs = sp.segments
  const anchorsBefore: Pt[] = [sp.start]
  for (const s of segs) anchorsBefore.push(s.end)
  const reversed: Cubic[] = []
  for (let i = segs.length - 1; i >= 0; i -= 1) {
    const seg = segs[i] as Cubic
    reversed.push({ c1: seg.c2, c2: seg.c1, end: anchorsBefore[i] as Pt })
  }
  return { start: anchorsBefore[segs.length] as Pt, segments: reversed, closed: sp.closed }
}

// Shift which anchor of a closed ring is the start (segments reorder cyclically).
const rotateSubpath = (sp: Subpath, offset: number): Subpath => {
  const n = sp.segments.length
  const k = ((offset % n) + n) % n
  if (k === 0 || !sp.closed) return sp
  const anchorsBefore: Pt[] = [sp.start]
  for (const s of sp.segments) anchorsBefore.push(s.end)
  const segments: Cubic[] = []
  for (let i = 0; i < n; i += 1) segments.push(sp.segments[(k + i) % n] as Cubic)
  return { start: anchorsBefore[k] as Pt, segments, closed: true }
}

/**
 * Pick the rotation and winding of `to` (a closed ring) that puts its anchors
 * closest to `from`'s - so the shape settles into place instead of spinning or
 * turning inside out. Both must already be reconciled to the same count. Open
 * subpaths have a fixed start/end, so they pass through unchanged.
 */
export function align(from: Subpath, to: Subpath): Subpath {
  const n = from.segments.length
  if (!from.closed || !to.closed || to.segments.length !== n) return to
  // Match on centroid/scale-normalized anchors so a size or position difference
  // between the two shapes doesn't swamp the rotational cost; the winning rotation
  // and winding are then applied to the REAL `to` for interpolation.
  const fromAnchors = normalizeAnchors(ringAnchors(from))
  let best = to
  let bestCost = Number.POSITIVE_INFINITY
  for (const candidate of [to, reverseSubpath(to)]) {
    const anchors = normalizeAnchors(ringAnchors(candidate))
    for (let off = 0; off < n; off += 1) {
      let cost = 0
      for (let i = 0; i < n; i += 1) {
        const a = fromAnchors[i] as Pt
        const b = anchors[(i + off) % n] as Pt
        cost += (a.x - b.x) ** 2 + (a.y - b.y) ** 2
      }
      if (cost < bestCost) {
        bestCost = cost
        best = rotateSubpath(candidate, off)
      }
    }
  }
  return best
}

/** Interpolate two reconciled subpaths (same segment count) at fraction f. */
export function lerpSubpath(a: Subpath, b: Subpath, f: number): Subpath {
  const segments: Cubic[] = []
  // reconcile() makes the counts equal; min() is a defensive guard so a
  // mismatch can never dereference an undefined segment.
  const n = Math.min(a.segments.length, b.segments.length)
  for (let i = 0; i < n; i += 1) {
    const sa = a.segments[i] as Cubic
    const sb = b.segments[i] as Cubic
    segments.push({ c1: lerpPt(sa.c1, sb.c1, f), c2: lerpPt(sa.c2, sb.c2, f), end: lerpPt(sa.end, sb.end, f) })
  }
  return { start: lerpPt(a.start, b.start, f), segments, closed: a.closed }
}

/** The centroid of a subpath's ring anchors - its rough position, for matching. */
export function subpathCentroid(sp: Subpath): Pt {
  return centroid(ringAnchors(sp))
}

/** The (unsigned) enclosed area of a subpath's ring anchors - its rough size, for matching. */
export function subpathArea(sp: Subpath): number {
  const a = ringAnchors(sp)
  let area = 0
  for (let i = 0; i < a.length; i += 1) {
    const p = a[i] as Pt
    const q = a[(i + 1) % a.length] as Pt
    area += p.x * q.y - q.x * p.y
  }
  return Math.abs(area) / 2
}

/**
 * A degenerate copy of `sp` with every anchor and control collapsed onto `pt` -
 * so a surplus subpath can shrink to a point (or grow from one) rather than
 * being padded with an unrelated shape. Keeps the segment count for reconciliation.
 */
export function collapseToPoint(sp: Subpath, pt: Pt): Subpath {
  return { start: pt, segments: sp.segments.map(() => ({ c1: pt, c2: pt, end: pt })), closed: sp.closed }
}

/**
 * True if a subpath has collapsed to a single point (every anchor and control
 * within `eps` of the start) - a not-yet-grown or fully-shrunk piece, which
 * should emit nothing so it never paints a dot on a stroked path.
 */
export function isPointSubpath(sp: Subpath, eps = 0.01): boolean {
  const near = (p: Pt): boolean => Math.abs(p.x - sp.start.x) <= eps && Math.abs(p.y - sp.start.y) <= eps
  for (const seg of sp.segments) {
    if (!near(seg.c1) || !near(seg.c2) || !near(seg.end)) return false
  }
  return true
}

/** Emit a subpath as a cubic `d` string. */
export function subpathToD(subpath: Subpath): string {
  let d = `M ${round(subpath.start.x)} ${round(subpath.start.y)}`
  for (const seg of subpath.segments) {
    d += ` C ${round(seg.c1.x)} ${round(seg.c1.y)} ${round(seg.c2.x)} ${round(seg.c2.y)} ${round(seg.end.x)} ${round(seg.end.y)}`
  }
  return subpath.closed ? `${d} Z` : d
}
