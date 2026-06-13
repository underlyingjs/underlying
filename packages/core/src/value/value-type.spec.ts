import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetWarnings, warnOnce } from './warn'
import { formatChannelNumber, type ChannelMeta } from './value-type'

const meta = (overrides: Partial<ChannelMeta> = {}): ChannelMeta => ({ precision: 4, ...overrides })

describe('formatChannelNumber', () => {
  it('rounds to the meta precision and never emits scientific notation', () => {
    expect(formatChannelNumber(0.123456, meta({ precision: 4 }))).toBe('0.1235')
    expect(formatChannelNumber(1e-7, meta({ precision: 4 }))).toBe('0')
    expect(formatChannelNumber(255.4, meta({ precision: 0 }))).toBe('255')
    expect(formatChannelNumber(50, meta({ precision: 4 }))).toBe('50')
  })

  it('clamps to min/max before rounding', () => {
    expect(formatChannelNumber(-12, meta({ precision: 0, min: 0, max: 65025 }))).toBe('0')
    expect(formatChannelNumber(70000, meta({ precision: 0, min: 0, max: 65025 }))).toBe('65025')
    expect(formatChannelNumber(1.4, meta({ precision: 4, min: 0, max: 1 }))).toBe('1')
  })

  it('formats negative zero as "0"', () => {
    expect(formatChannelNumber(-0, meta({ precision: 0 }))).toBe('0')
    expect(formatChannelNumber(-0.0001, meta({ precision: 0 }))).toBe('0')
  })

  it('is deterministic: identical input yields byte-identical output', () => {
    const m = meta({ precision: 2 })
    expect(formatChannelNumber(33.333333, m)).toBe(formatChannelNumber(33.333333, m))
    expect(formatChannelNumber(33.333333, m)).toBe('33.33')
  })
})

describe('warnOnce', () => {
  afterEach(() => {
    __resetWarnings()
    vi.restoreAllMocks()
  })

  it('emits a given key exactly once', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnOnce('k', 'first')
    warnOnce('k', 'second')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith('[underlying] first')
  })

  it('emits distinct keys independently', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    warnOnce('a', 'a')
    warnOnce('b', 'b')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
