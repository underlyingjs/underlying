import { formatChannelNumber, type ChannelMeta, type ValueType } from '../value-type'

// One channel; the shape IS the unit. Cross-unit interpolation is forbidden -
// a '50%' target and a '240px' current are different shapes, reconciled by a
// measure-once multiplier (see convert) rather than mixed numerically.
const LENGTH_META: ChannelMeta = { precision: 4, restDelta: 0.01, restSpeed: 0.1 }
const LENGTH_METAS: readonly ChannelMeta[] = [LENGTH_META]

const LENGTH_RE = /^([+-]?(?:\d+\.?\d*|\.\d+))(px|%|em|rem|vw|vh|vmin|vmax|deg|rad|turn)$/

// Angle units convert arithmetically (no layout measurement). Reference: degrees.
const ANGLE_TO_DEG: Record<string, number | undefined> = { deg: 1, rad: 180 / Math.PI, turn: 360 }

export const lengthValueType: ValueType = {
  parse(raw) {
    // Bare numbers default to px (the registry seeds length properties).
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? { channels: [raw], shape: 'px' } : null
    }
    const s = raw.trim()
    if (s === '') return null
    // Unitless zero is valid CSS for lengths; it carries no unit of its own.
    if (s === '0' || s === '+0' || s === '-0') return { channels: [0], shape: 'px' }
    const match = LENGTH_RE.exec(s)
    if (match === null) return null
    return { channels: [Number(match[1])], shape: match[2] as string }
  },
  format(channels, shape) {
    return formatChannelNumber(channels[0] ?? 0, LENGTH_META) + shape
  },
  channels() {
    return LENGTH_METAS
  },
  convert(fromShape, toShape, measure) {
    const fromAngle = ANGLE_TO_DEG[fromShape]
    const toAngle = ANGLE_TO_DEG[toShape]
    if (fromAngle !== undefined || toAngle !== undefined) {
      // Angle <-> angle only; a cross-kind conversion (deg <-> px) is undefined.
      if (fromAngle === undefined || toAngle === undefined) return null
      return fromAngle / toAngle
    }
    const from = measure(fromShape)
    const to = measure(toShape)
    if (from === null || to === null || to === 0) return null
    return from / to
  },
}
