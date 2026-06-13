import { afterEach, describe, expect, it } from 'vitest'
import { __resetComplexCaches, __tokenizeCount, complexValueType } from './complex'

const { parse, format, reconcile, channels } = complexValueType

afterEach(() => {
  __resetComplexCaches()
})

const SHADOW = '0px 12px 32px rgba(0, 0, 0, 0.35)'

describe('complexValueType.parse', () => {
  it('decomposes numbers and embedded colors into channels in template order', () => {
    const parsed = parse(SHADOW)
    expect(parsed?.channels).toEqual([0, 12, 32, 0, 0, 0, 0.35])
    // The shape round-trips through format byte-for-byte.
    expect(format(parsed!.channels, parsed!.shape)).toBe(SHADOW)
  })

  it('treats same token kinds with different literals or units as different shapes', () => {
    const blur = parse('blur(4px)')
    const brightness = parse('brightness(1.2)')
    expect(blur?.shape).not.toBe(brightness?.shape)
    expect(format(blur!.channels, blur!.shape)).toBe('blur(4px)')
    expect(format(brightness!.channels, brightness!.shape)).toBe('brightness(1.2)')
  })

  it('returns null for values with no animatable tokens', () => {
    expect(parse('none')).toBeNull()
    expect(parse('solid')).toBeNull()
  })

  it('reports channel metas matching the channel layout (1 per number, 4 per color)', () => {
    const metas = channels(parse(SHADOW)!.shape)
    expect(metas).toHaveLength(7)
  })
})

describe('complexValueType.reconcile', () => {
  it('realigns a color-first computed box-shadow against a color-last author target', () => {
    const target = parse(SHADOW)!
    // Chromium serializes computed box-shadow with the color first.
    const computed = 'rgba(0, 0, 0, 0.35) 0px 12px 32px'
    const reconciled = reconcile?.(computed, target.shape)
    expect(reconciled?.channels).toEqual([0, 12, 32, 0, 0, 0, 0.35])
    expect(reconciled?.shape).toBe(target.shape)
  })

  it('synthesizes the zero-equivalent from none (numbers 0, colors transparent)', () => {
    const target = parse(SHADOW)!
    const reconciled = reconcile?.('none', target.shape)
    expect(reconciled?.channels).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('returns null when the token counts differ after realignment', () => {
    const oneShadow = parse(SHADOW)!
    const twoShadows = '0px 1px 2px rgba(0, 0, 0, 1), 0px 2px 4px rgba(0, 0, 0, 1)'
    expect(reconcile?.(twoShadows, oneShadow.shape)).toBeNull()
  })
})

describe('complexValueType.format', () => {
  it('never tokenizes on the hot path - the template is reused', () => {
    __resetComplexCaches()
    const parsed = parse(SHADOW)!
    expect(__tokenizeCount()).toBe(1)
    for (let i = 0; i < 100; i++) format(parsed.channels, parsed.shape)
    expect(__tokenizeCount()).toBe(1)
  })
})
