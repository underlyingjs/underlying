import { describe, expect, it } from 'vitest'
import { clamp01, DEFAULT_RANGE, rawProgress, resolveOffset, resolveRange, type Box } from './range'

const box: Box = { start: 1000, size: 500 }
const viewport = 1000

describe('resolveOffset', () => {
  it('resolves edge pairs (element edge meets viewport edge)', () => {
    expect(resolveOffset('start end', box, viewport)).toBe(0) // top enters from the bottom
    expect(resolveOffset('end start', box, viewport)).toBe(1500) // bottom leaves past the top
    expect(resolveOffset('start start', box, viewport)).toBe(1000) // top reaches the top
    expect(resolveOffset('center center', box, viewport)).toBe(750)
  })

  it('treats a number and % as a fraction of the intersection travel (0 and 1 match the default range)', () => {
    expect(resolveOffset(0, box, viewport)).toBe(resolveOffset('start end', box, viewport))
    expect(resolveOffset(1, box, viewport)).toBe(resolveOffset('end start', box, viewport))
    expect(resolveOffset(0.5, box, viewport)).toBe(750)
    expect(resolveOffset('50%', box, viewport)).toBe(750)
  })

  it('treats px as an absolute scroll position', () => {
    expect(resolveOffset('200px', box, viewport)).toBe(200)
  })

  it('maps axis-specific edges (top/bottom, left/right) onto start/end', () => {
    expect(resolveOffset('top bottom', box, viewport)).toBe(resolveOffset('start end', box, viewport))
    expect(resolveOffset('bottom top', box, viewport)).toBe(resolveOffset('end start', box, viewport))
  })
})

describe('resolveRange + rawProgress', () => {
  it('the default range spans the whole intersection', () => {
    const { enter, leave } = resolveRange(DEFAULT_RANGE, box, viewport)
    expect(enter).toBe(0)
    expect(leave).toBe(1500)
  })

  it('maps scroll position to unclamped progress', () => {
    expect(rawProgress(750, 0, 1500)).toBe(0.5)
    expect(rawProgress(0, 0, 1500)).toBe(0)
    expect(rawProgress(1500, 0, 1500)).toBe(1)
    expect(rawProgress(-300, 0, 1500)).toBeCloseTo(-0.2, 6) // before the range
    expect(rawProgress(3000, 0, 1500)).toBe(2) // after the range
  })

  it('handles a zero-length span without dividing by zero', () => {
    expect(rawProgress(99, 100, 100)).toBe(0)
    expect(rawProgress(100, 100, 100)).toBe(1)
  })
})

describe('clamp01', () => {
  it('clamps to [0, 1]', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(0.3)).toBe(0.3)
  })
})
