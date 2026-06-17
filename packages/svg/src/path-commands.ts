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

/**
 * Parse a `d` string into subpaths of absolute cubic segments. Handles M, L, H,
 * V, C, S, Q, T, Z (and their relative forms). Elliptical arcs (A/a) are not
 * supported by the command morph - use the resampling `morph()` for those.
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
      throw new Error('@underlying/svg: morphCommands does not support arcs (A); use morph() for arc paths')
    }
  }
  flush(false)
  return subpaths
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
// (by chord) segment in half. Original anchors are kept; new anchors land ON the
// curves, so they interpolate smoothly while corners stay corners.
const subdivideTo = (subpath: Subpath, count: number): Subpath => {
  if (subpath.segments.length >= count) return subpath
  // anchors before each segment, to measure chord length
  const segments = subpath.segments.slice()
  const anchorsBefore: Pt[] = [subpath.start]
  for (const seg of segments) anchorsBefore.push(seg.end)

  while (segments.length < count) {
    let longest = 0
    let best = -1
    for (let s = 0; s < segments.length; s += 1) {
      const from = anchorsBefore[s] as Pt
      const seg = segments[s] as Cubic
      const dx = seg.end.x - from.x
      const dy = seg.end.y - from.y
      const chord = dx * dx + dy * dy
      if (chord > longest) {
        longest = chord
        best = s
      }
    }
    if (best < 0) break
    const from = anchorsBefore[best] as Pt
    const [left, right] = splitCubic(from, segments[best] as Cubic, 0.5)
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
  const fromAnchors = ringAnchors(from)
  let best = to
  let bestCost = Number.POSITIVE_INFINITY
  for (const candidate of [to, reverseSubpath(to)]) {
    const anchors = ringAnchors(candidate)
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

/** Emit a subpath as a cubic `d` string. */
export function subpathToD(subpath: Subpath): string {
  let d = `M ${round(subpath.start.x)} ${round(subpath.start.y)}`
  for (const seg of subpath.segments) {
    d += ` C ${round(seg.c1.x)} ${round(seg.c1.y)} ${round(seg.c2.x)} ${round(seg.c2.y)} ${round(seg.end.x)} ${round(seg.end.y)}`
  }
  return subpath.closed ? `${d} Z` : d
}
