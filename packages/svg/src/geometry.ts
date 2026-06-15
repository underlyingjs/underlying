/**
 * A subset of SVGGeometryElement: anything that can report its length and sample
 * a point at a given arc distance. Real `<path>`/`<line>`/`<polyline>` elements
 * satisfy it natively; tests pass a plain object.
 */
export interface PathGeometry {
  getTotalLength(): number
  getPointAtLength(distance: number): { x: number; y: number }
}

/** A path source: a CSS selector or any geometry element/object. */
export type PathInput = string | PathGeometry

/** A sampled point on a path: position plus the tangent direction (degrees). */
export interface PathPoint {
  x: number
  y: number
  /** tangent direction in degrees, fed to autoRotate */
  angle: number
}

export interface SamplePathOptions {
  /**
   * Distance, as a fraction of total length, used to estimate the tangent angle
   * from two neighbouring samples. Smaller is sharper but noisier. Default 0.001.
   */
  tangentEpsilon?: number
}

export interface PathSampler {
  /** Total path length, in the path's user units. */
  readonly length: number
  /** Point at progress t (clamped to 0..1), with the tangent angle. */
  at(t: number): PathPoint
}

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)

/** Resolve a {@link PathInput} to a geometry source (querySelector for strings). */
export function resolvePathGeometry(path: PathInput): PathGeometry {
  if (typeof path !== 'string') return path
  if (typeof document === 'undefined') {
    throw new Error('@underlying/svg: a selector needs a DOM; pass an element on the server')
  }
  const element = document.querySelector(path)
  if (element === null) throw new Error(`@underlying/svg: no element matches "${path}"`)
  return element as unknown as PathGeometry
}

/**
 * Wrap a path in a length-normalized sampler: feed it t in 0..1 and read back the
 * point plus tangent angle. Total length is measured once; each `at()` is two
 * getPointAtLength() reads (the point, and a neighbour for the tangent).
 */
export function samplePath(path: PathInput, options: SamplePathOptions = {}): PathSampler {
  const geometry = resolvePathGeometry(path)
  const length = geometry.getTotalLength()
  const eps = (options.tangentEpsilon ?? 0.001) * length || 0.0001

  return {
    length,
    at(t) {
      const distance = clamp01(t) * length
      const point = geometry.getPointAtLength(distance)
      const behind = geometry.getPointAtLength(Math.max(0, distance - eps))
      const ahead = geometry.getPointAtLength(Math.min(length, distance + eps))
      const angle = (Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI
      return { x: point.x, y: point.y, angle }
    },
  }
}
