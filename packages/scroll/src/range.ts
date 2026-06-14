// Pure offset grammar + progress math. Zero DOM. An entry resolves to a scroll
// position (px); a range is [enter, leave]; progress is a linear map between them.

export type Edge = 'start' | 'center' | 'end' | 'top' | 'bottom' | 'left' | 'right'
export type OffsetEntry = `${Edge} ${Edge}` | number | `${number}%` | `${number}px`
export type ScrollRange = readonly [OffsetEntry, OffsetEntry]

/** An element box on the active axis, in scroller CONTENT coordinates (not viewport-relative). */
export interface Box {
  readonly start: number
  readonly size: number
}

/** Default [enter, leave]: p hits 0 as the element enters from the far edge, 1 as it leaves the near edge. */
export const DEFAULT_RANGE: ScrollRange = ['start end', 'end start']

const EDGE: Record<Edge, number> = {
  start: 0,
  top: 0,
  left: 0,
  center: 0.5,
  end: 1,
  bottom: 1,
  right: 1,
}

const edgeFraction = (edge: string): number => EDGE[edge as Edge] ?? 0

// Fraction of the full intersection travel: f=0 puts the element's start edge on
// the viewport's far edge, f=1 puts its end edge on the viewport's near edge -
// so 0 and 1 coincide with the 'start end' / 'end start' default range.
const intersection = (f: number, box: Box, viewport: number): number =>
  box.start - viewport + f * (viewport + box.size)

/**
 * Resolve one offset entry to the scroll position (px) at which it is reached.
 * - `'<elementEdge> <viewportEdge>'`: the element edge aligns with the viewport edge.
 * - number / `'<n>%'`: a fraction 0..1 of the full intersection travel.
 * - `'<n>px'`: an absolute scroll position.
 */
export function resolveOffset(entry: OffsetEntry, box: Box, viewport: number): number {
  if (typeof entry === 'number') return intersection(entry, box, viewport)
  if (entry.endsWith('px')) return Number.parseFloat(entry)
  if (entry.endsWith('%')) return intersection(Number.parseFloat(entry) / 100, box, viewport)
  const space = entry.indexOf(' ')
  const elem = edgeFraction(entry.slice(0, space))
  const vp = edgeFraction(entry.slice(space + 1))
  return box.start + elem * box.size - vp * viewport
}

export function resolveRange(range: ScrollRange, box: Box, viewport: number): { enter: number; leave: number } {
  return { enter: resolveOffset(range[0], box, viewport), leave: resolveOffset(range[1], box, viewport) }
}

/** Unclamped progress: < 0 before the range, > 1 after it. */
export function rawProgress(scrollPos: number, enter: number, leave: number): number {
  const span = leave - enter
  if (span === 0) return scrollPos < enter ? 0 : 1
  return (scrollPos - enter) / span
}

export const clamp01 = (p: number): number => (p < 0 ? 0 : p > 1 ? 1 : p)
