import { describe, expect, it } from 'vitest'
import { colorValueType, formatColor, parseColor } from './color'

describe('parseColor (pure syntaxes, no DOM)', () => {
  it('parses hex in 3, 4, 6, and 8 digit forms to squared channels', () => {
    expect(parseColor('#f04')).toEqual([65025, 0, 4624, 1])
    expect(parseColor('#ff0044')).toEqual([65025, 0, 4624, 1])
    expect(parseColor('#ff004480')).toEqual([65025, 0, 4624, 128 / 255])
    expect(parseColor('#f048')).toEqual([65025, 0, 4624, 0x88 / 255])
  })

  it('parses rgb()/rgba() in comma, slash, and percentage forms', () => {
    expect(parseColor('rgb(16, 185, 129)')).toEqual([256, 34225, 16641, 1])
    expect(parseColor('rgba(16, 185, 129, 0.5)')).toEqual([256, 34225, 16641, 0.5])
    expect(parseColor('rgb(16 185 129 / 50%)')).toEqual([256, 34225, 16641, 0.5])
    expect(parseColor('rgb(100%, 0%, 0%)')).toEqual([65025, 0, 0, 1])
  })

  it('parses hsl() by converting to rgb at parse time', () => {
    expect(parseColor('hsl(120, 50%, 50%)')).toEqual([4064.0625, 36576.5625, 4064.0625, 1])
  })

  it('parses the transparent keyword without a DOM', () => {
    expect(parseColor('transparent')).toEqual([0, 0, 0, 0])
  })

  it('does not parse currentcolor, oklch(), lab(), color(), or invalid hex', () => {
    expect(parseColor('currentcolor')).toBeNull()
    expect(parseColor('oklch(0.7 0.1 200)')).toBeNull()
    expect(parseColor('lab(50% 40 59)')).toBeNull()
    expect(parseColor('color(display-p3 1 0 0)')).toBeNull()
    expect(parseColor('#fg0')).toBeNull()
    expect(parseColor('')).toBeNull()
  })

  it('returns null for named colors when no document is present', () => {
    expect(parseColor('rebeccapurple')).toBeNull()
  })
})

describe('formatColor', () => {
  it('produces canonical byte-stable rgba() with integer rgb and clean alpha', () => {
    expect(formatColor([256, 34225, 16641, 1])).toBe('rgba(16, 185, 129, 1)')
    expect(formatColor([65025, 0, 4624, 0.5])).toBe('rgba(255, 0, 68, 0.5)')
    expect(formatColor([0, 0, 0, 128 / 255])).toBe('rgba(0, 0, 0, 0.502)')
  })

  it('clamps overshoot below zero and above 65025 before the square root', () => {
    expect(formatColor([-50, 70000, 4624, 1.4])).toBe('rgba(0, 255, 68, 1)')
    expect(formatColor([0, 0, 0, -0.2])).toBe('rgba(0, 0, 0, 0)')
  })
})

describe('colorValueType', () => {
  it('is non-spatial so colors keep animating under reduced-motion fade', () => {
    expect(colorValueType.spatial).toBe(false)
  })

  it('parses into the single rgba shape and round-trips through format', () => {
    const parsed = colorValueType.parse('#10b981')
    expect(parsed).not.toBeNull()
    expect(parsed?.shape).toBe('rgba')
    expect(colorValueType.format(parsed!.channels, parsed!.shape)).toBe('rgba(16, 185, 129, 1)')
  })

  it('exposes four channel metas with squared-scaled rest tolerances', () => {
    const metas = colorValueType.channels('rgba')
    expect(metas).toHaveLength(4)
    expect(metas[0]).toMatchObject({ precision: 0, min: 0, max: 65025 })
    expect(metas[3]).toMatchObject({ precision: 4, min: 0, max: 1 })
  })
})
