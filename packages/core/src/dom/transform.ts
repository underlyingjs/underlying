export type TransformChannel =
  | 'perspective'
  | 'x'
  | 'y'
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ'
  | 'rotate'
  | 'skewX'
  | 'skewY'
  | 'scale'
  | 'scaleX'
  | 'scaleY'

export type TransformChannels = Partial<Record<TransformChannel, number>>

/** Every key that resolves into the transform string (i.e. all but opacity). */
export const TRANSFORM_KEYS = [
  'perspective',
  'x',
  'y',
  'rotateX',
  'rotateY',
  'rotateZ',
  'rotate',
  'skewX',
  'skewY',
  'scale',
  'scaleX',
  'scaleY',
] as const satisfies readonly TransformChannel[]

// transform-origin is a separate CSS property, not a transform function, so it
// is its own little channel group: two percentages forming `X% Y%`.
export type OriginChannel = 'originX' | 'originY'
export type OriginChannels = Partial<Record<OriginChannel, number>>
export const ORIGIN_KEYS = ['originX', 'originY'] as const satisfies readonly OriginChannel[]

/** transform-origin from originX/originY percentages; an unset axis is center. */
export function formatOrigin(c: OriginChannels): string {
  return `${c.originX ?? 50}% ${c.originY ?? 50}%`
}

/**
 * Single source of the transform string format. The WAAPI delegation builds
 * its keyframes with it and the binding writes frames with it - both MUST
 * produce byte-identical strings for the same values, or handoffs would
 * visually jump.
 *
 * Canonical order: perspective first (so the 3D rotations have depth), then
 * translate, rotations, skews, scales. The functions do not all commute, so a
 * fixed order is what keeps every code path identical.
 */
export function formatTransform(c: TransformChannels): string {
  const parts: string[] = []
  // perspective(0) collapses the element to a point, so only emit it when positive.
  if (c.perspective !== undefined && c.perspective > 0) parts.push(`perspective(${c.perspective}px)`)
  if (c.x !== undefined || c.y !== undefined) parts.push(`translate3d(${c.x ?? 0}px, ${c.y ?? 0}px, 0)`)
  if (c.rotateX !== undefined) parts.push(`rotateX(${c.rotateX}deg)`)
  if (c.rotateY !== undefined) parts.push(`rotateY(${c.rotateY}deg)`)
  if (c.rotateZ !== undefined) parts.push(`rotateZ(${c.rotateZ}deg)`)
  if (c.rotate !== undefined) parts.push(`rotate(${c.rotate}deg)`)
  if (c.skewX !== undefined) parts.push(`skewX(${c.skewX}deg)`)
  if (c.skewY !== undefined) parts.push(`skewY(${c.skewY}deg)`)
  if (c.scale !== undefined) parts.push(`scale(${c.scale})`)
  if (c.scaleX !== undefined) parts.push(`scaleX(${c.scaleX})`)
  if (c.scaleY !== undefined) parts.push(`scaleY(${c.scaleY})`)
  return parts.join(' ')
}
