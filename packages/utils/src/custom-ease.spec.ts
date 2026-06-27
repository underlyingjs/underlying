import { describe, expect, it } from 'vitest'
import { cubicBezier, customEase } from './custom-ease'

describe('customEase', () => {
  it('lands at 0 and 1 from a path, and is monotonic', () => {
    const e = customEase('M0,0 C0.25,0.1 0.25,1 1,1')
    expect(e(0)).toBeCloseTo(0, 6)
    expect(e(1)).toBeCloseTo(1, 6)
    let prev = e(0)
    for (let i = 1; i <= 50; i++) {
      const y = e(i / 50)
      expect(y).toBeGreaterThanOrEqual(prev - 1e-6)
      prev = y
    }
  })

  it('matches cubicBezier within sampling tolerance', () => {
    const path = customEase('M0,0 C0.25,0.1 0.25,1 1,1')
    const exact = cubicBezier(0.25, 0.1, 0.25, 1)
    for (let i = 0; i <= 10; i++) expect(path(i / 10)).toBeCloseTo(exact(i / 10), 1)
  })

  it('handles a relative path identically to its absolute form', () => {
    const abs = customEase('M0,0 C0.4,0 0.6,1 1,1')
    const rel = customEase('m0,0 c0.4,0 0.6,1 1,1')
    for (let i = 0; i <= 10; i++) expect(rel(i / 10)).toBeCloseTo(abs(i / 10), 6)
  })

  it('normalizes a non-unit artboard (and SVG units) to 0..1', () => {
    const e = customEase('M0,0 C240,0 360,400 600,400')
    expect(e(0)).toBeCloseTo(0, 6)
    expect(e(1)).toBeCloseTo(1, 6)
    expect(e(0.5)).toBeGreaterThan(0)
    expect(e(0.5)).toBeLessThan(1)
  })

  it('accepts a points array and passes near the controls', () => {
    const e = customEase([
      [0, 0],
      [0.5, 0.2],
      [1, 1],
    ])
    expect(e(0)).toBe(0)
    expect(e(1)).toBe(1)
    expect(e(0.5)).toBeCloseTo(0.2, 1)
  })

  it('falls back to identity on a degenerate input', () => {
    expect(customEase([[0, 0]])(0.5)).toBe(0.5)
  })

  it('skips an unsupported arc command without throwing', () => {
    expect(() => customEase('M0,0 A1,1 0 0 1 1,1')).not.toThrow()
  })

  it('does not hang on a stray number after Z', () => {
    expect(() => customEase('M0,0 L1,1 Z 0')).not.toThrow()
    expect(customEase('M0,0 L1,1 Z 0')(0)).toBeCloseTo(0, 6)
  })

  it('handles a mixed-family smooth curve (S after Q) and still lands 0..1', () => {
    const e = customEase('M0,0 Q0.3,1 0.6,0.6 S0.9,0 1,1')
    expect(e(0)).toBeCloseTo(0, 6)
    expect(e(1)).toBeCloseTo(1, 6)
  })
})
