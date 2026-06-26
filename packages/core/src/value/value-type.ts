/**
 * The value-type contract: how a CSS property name maps to the scalar channels
 * the physics drives. A `ValueType` decomposes a raw value into channels
 * (`parse`), names their magnitude/precision (`channels`), and is the SOLE
 * producer of that property's CSS strings (`format`) - the analogue of
 * `formatTransform` for the transform property. Equal shapes are
 * channel-for-channel interpolable AND share a format template.
 */
export interface ParsedValue {
  /** Scalar channels the physics drives, in template order. */
  channels: number[]
  /**
   * Shape identity: equal shapes are channel-for-channel interpolable AND share
   * a format template. For the complex type the shape IS the compiled template -
   * same token kinds with different literals are different shapes.
   */
  shape: string
}

/** Per-channel metadata: format precision, clamp bounds, and rest tolerances scaled to the channel's magnitude. */
export interface ChannelMeta {
  /** Decimals kept at format time. The simulation always runs full precision. */
  precision: number
  /** Format-time clamp - spring overshoot on bounded channels (rgb, alpha). */
  min?: number
  max?: number
  /** Rest tolerance scaled to the channel's magnitude. An explicit per-call restDelta wins. */
  restDelta?: number
  /** Rest speed scaled to the channel's magnitude (channel-units/s). Per-call restSpeed wins. */
  restSpeed?: number
}

/** px per 1 unit in this element+property context; null = not measurable. */
export type MeasureUnit = (unit: string) => number | null

export interface ValueType {
  /** Decompose an author/computed value. null = not animatable - the caller snaps. */
  parse(raw: string | number): ParsedValue | null
  /** Pure, deterministic, byte-identical for identical input. The ONLY producer of this property's CSS strings. */
  format(channels: readonly number[], shape: string): string
  /** Per-channel metadata for a shape; length matches parse().channels. */
  channels(shape: string): readonly ChannelMeta[]
  /** Linear multiplier mapping channel values AND velocities between shapes; null = not convertible (caller snaps). */
  convert?(fromShape: string, toShape: string, measure: MeasureUnit): number | null
  /** Re-read a raw value through a target shape: kind-stable realign, 'none' synthesis. null = incompatible. */
  reconcile?(raw: string, targetShape: string): ParsedValue | null
  /** false for non-spatial types (colors): they stay animated under reduced-motion 'fade'. Default true. */
  spatial?: boolean
}

/**
 * The one formatter primitive every value type shares: clamp to the channel's
 * bounds, round to its precision, and emit a byte-stable decimal string - no
 * scientific notation, no negative zero, no sub-precision churn. Rounding makes
 * equal floats produce byte-equal strings across runs and frame rates.
 */
export function formatChannelNumber(value: number, meta: ChannelMeta): string {
  let v = value
  // Never emit 'NaN'/'Infinity' into a CSS string (a non-finite source value, a
  // bad target). Fall back to the channel's floor, or 0.
  if (!Number.isFinite(v)) v = meta.min ?? 0
  if (meta.min !== undefined && v < meta.min) v = meta.min
  if (meta.max !== undefined && v > meta.max) v = meta.max
  const factor = 10 ** meta.precision
  v = Math.round(v * factor) / factor
  return v === 0 ? '0' : String(v)
}
