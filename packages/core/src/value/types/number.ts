import { formatChannelNumber, type ChannelMeta, type ValueType } from '../value-type'

// Unitless scalar - flexGrow, fontWeight, custom properties registered by the
// app. Shape is the empty string: one canonical shape, always interpolable.
const NUMBER_META: ChannelMeta = { precision: 4, restDelta: 0.01, restSpeed: 0.1 }
const NUMBER_METAS: readonly ChannelMeta[] = [NUMBER_META]

export const numberValueType: ValueType = {
  parse(raw) {
    if (typeof raw === 'string' && raw.trim() === '') return null
    const n = Number(raw)
    return Number.isFinite(n) ? { channels: [n], shape: '' } : null
  },
  format(channels) {
    return formatChannelNumber(channels[0] ?? 0, NUMBER_META)
  },
  channels() {
    return NUMBER_METAS
  },
}
