import { describe, expect, it } from 'vitest'
import type { MeasureUnit } from '../value-type'
import { lengthValueType } from './length'
import { numberValueType } from './number'

const { parse, format, convert } = lengthValueType

describe('lengthValueType.parse', () => {
  it('parses floats with every supported unit', () => {
    expect(parse('240px')).toEqual({ channels: [240], shape: 'px' })
    expect(parse('50%')).toEqual({ channels: [50], shape: '%' })
    expect(parse('1.5em')).toEqual({ channels: [1.5], shape: 'em' })
    expect(parse('.25rem')).toEqual({ channels: [0.25], shape: 'rem' })
    expect(parse('100vw')).toEqual({ channels: [100], shape: 'vw' })
    expect(parse('-12.5vh')).toEqual({ channels: [-12.5], shape: 'vh' })
    expect(parse('45deg')).toEqual({ channels: [45], shape: 'deg' })
    expect(parse('0.5turn')).toEqual({ channels: [0.5], shape: 'turn' })
  })

  it('treats unitless zero as px and bare numbers as px', () => {
    expect(parse('0')).toEqual({ channels: [0], shape: 'px' })
    expect(parse(160)).toEqual({ channels: [160], shape: 'px' })
  })

  it('rejects calc(), auto, keywords, empty, and non-finite', () => {
    expect(parse('calc(100% - 10px)')).toBeNull()
    expect(parse('auto')).toBeNull()
    expect(parse('fit-content')).toBeNull()
    expect(parse('')).toBeNull()
    expect(parse('10ch')).toBeNull()
    expect(parse(Number.NaN)).toBeNull()
  })
})

describe('lengthValueType.format', () => {
  it('appends the unit and is byte-stable', () => {
    expect(format([50], '%')).toBe('50%')
    expect(format([239.99996], 'px')).toBe('240px')
    expect(format([0], 'px')).toBe('0px')
  })
})

describe('lengthValueType.convert', () => {
  const measure: MeasureUnit = (unit) => (unit === 'px' ? 1 : unit === '%' ? 4 : null)

  it('returns measure(from)/measure(to) for lengths', () => {
    // 240px in a 400px-wide parent: 1% = 4px, so px->% multiplier is 1/4.
    expect(convert?.('px', '%', measure)).toBe(0.25)
    expect(convert?.('%', 'px', measure)).toBe(4)
  })

  it('converts angle units arithmetically without measurement', () => {
    expect(convert?.('turn', 'deg', measure)).toBe(360)
    expect(convert?.('deg', 'turn', measure)).toBeCloseTo(1 / 360, 10)
    expect(convert?.('rad', 'deg', measure)).toBeCloseTo(180 / Math.PI, 10)
  })

  it('returns null for cross-kind and unmeasurable units', () => {
    expect(convert?.('px', 'deg', measure)).toBeNull()
    expect(convert?.('px', 'em', measure)).toBeNull()
  })
})

describe('numberValueType', () => {
  it('parses bare numbers and numeric strings to one unitless channel', () => {
    expect(numberValueType.parse(0.8)).toEqual({ channels: [0.8], shape: '' })
    expect(numberValueType.parse('700')).toEqual({ channels: [700], shape: '' })
  })

  it('rejects empty and non-numeric values', () => {
    expect(numberValueType.parse('')).toBeNull()
    expect(numberValueType.parse('10px')).toBeNull()
  })

  it('formats without a unit', () => {
    expect(numberValueType.format([0.8], '')).toBe('0.8')
  })
})
