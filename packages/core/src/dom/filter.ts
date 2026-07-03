/**
 * A typed builder for the CSS `filter` property. Each field maps to a filter
 * function; absent fields are omitted. Numbers take their natural unit (blur in
 * px, hueRotate in deg), the rest are plain multipliers/fractions. `dropShadow`
 * is a verbatim shadow string (`'0 2px 6px rgba(0,0,0,.4)'`).
 *
 * The functions are emitted in a FIXED canonical order, so two `filter()` results
 * with the same set of fields always share a function list - which is exactly what
 * the value engine needs to interpolate them channel-for-channel. Animate the
 * string like any other property: `animate(el, { filter: filter({ blur: 8 }) })`.
 */
export interface FilterSpec {
  /** Gaussian blur radius, px. */
  blur?: number
  /** Brightness multiplier (1 = unchanged, 0 = black). */
  brightness?: number
  /** Contrast multiplier (1 = unchanged). */
  contrast?: number
  /** Grayscale fraction, 0..1. */
  grayscale?: number
  /** Hue rotation, deg. */
  hueRotate?: number
  /** Invert fraction, 0..1. */
  invert?: number
  /** Opacity multiplier, 0..1 (distinct from the element's own opacity). */
  opacity?: number
  /** Saturation multiplier (1 = unchanged, 0 = grayscale). */
  saturate?: number
  /** Sepia fraction, 0..1. */
  sepia?: number
  /** A drop-shadow value verbatim, e.g. `'0 2px 6px rgba(0,0,0,.4)'`. */
  dropShadow?: string
}

// Canonical order + how each field renders. Fixed so any two results are interpolable.
const FILTER_FUNCTIONS: ReadonlyArray<readonly [keyof FilterSpec, (value: never) => string]> = [
  ['blur', (v: number) => `blur(${v}px)`],
  ['brightness', (v: number) => `brightness(${v})`],
  ['contrast', (v: number) => `contrast(${v})`],
  ['grayscale', (v: number) => `grayscale(${v})`],
  ['hueRotate', (v: number) => `hue-rotate(${v}deg)`],
  ['invert', (v: number) => `invert(${v})`],
  ['opacity', (v: number) => `opacity(${v})`],
  ['saturate', (v: number) => `saturate(${v})`],
  ['sepia', (v: number) => `sepia(${v})`],
  ['dropShadow', (v: string) => `drop-shadow(${v})`],
] as unknown as ReadonlyArray<readonly [keyof FilterSpec, (value: never) => string]>

/** Build a CSS `filter` string from a typed spec, in canonical function order. Empty spec -> `'none'`. */
export function filter(spec: FilterSpec): string {
  const parts: string[] = []
  for (const [key, render] of FILTER_FUNCTIONS) {
    const value = spec[key]
    if (value !== undefined) parts.push(render(value as never))
  }
  return parts.length > 0 ? parts.join(' ') : 'none'
}
