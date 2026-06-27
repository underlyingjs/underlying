import { describe, expect, it, vi } from 'vitest'
import { resolveEasing } from '@underlying/core'
import { rough, shake, slow, wiggle } from './procedural'
import './register'

const at = (ease: (p: number) => number, n = 50): number[] => Array.from({ length: n + 1 }, (_, i) => ease(i / n))

describe('wiggle / shake', () => {
  it('lands exactly at 0 and 1 for any count and wave', () => {
    for (const count of [1, 2.5, 6]) {
      for (const wave of ['sine', 'triangle', 'square'] as const) {
        const e = wiggle(count, { wave })
        expect(e(0)).toBeCloseTo(0, 9)
        expect(e(1)).toBeCloseTo(1, 9)
      }
    }
  })

  it('overshoots the target and decays (a struck-and-settle oscillation)', () => {
    const e = wiggle(3, { decay: 4 })
    const ys = at(e, 200)
    expect(Math.max(...ys)).toBeGreaterThan(1) // overshoots past the target at least once
    const early = ys.slice(0, 100).map((y) => Math.abs(y - 1))
    const late = ys.slice(100).map((y) => Math.abs(y - 1))
    expect(Math.max(...early)).toBeGreaterThan(Math.max(...late)) // amplitude decays
  })

  it('a zero-decay wiggle still lands at 1', () => {
    expect(wiggle(3, { decay: 0 })(1)).toBeCloseTo(1, 9)
  })

  it('shake is a buzzier preset that still arrives', () => {
    const e = shake()
    expect(e(0)).toBeCloseTo(0, 9)
    expect(e(1)).toBeCloseTo(1, 9)
  })
})

describe('slow', () => {
  it('is monotonic and pins the endpoints', () => {
    const e = slow(0.7, 0.7)
    expect(e(0)).toBe(0)
    expect(e(1)).toBe(1)
    let prev = e(0)
    for (let i = 1; i <= 100; i++) {
      const y = e(i / 100)
      expect(y).toBeGreaterThanOrEqual(prev - 1e-9)
      prev = y
    }
  })

  it('slows through the middle: shallow centre slope vs fast ends', () => {
    const e = slow(0.7, 0.8)
    const slope = (p: number): number => (e(p + 0.01) - e(p - 0.01)) / 0.02
    expect(slope(0.5)).toBeLessThan(slope(0.05))
    expect(slope(0.5)).toBeLessThan(slope(0.95))
  })
})

describe('rough', () => {
  it('is deterministic for a given seed and SSR-stable (no Math.random)', () => {
    const spy = vi.spyOn(Math, 'random')
    const a = rough({ seed: 7, points: 30 })
    const b = rough({ seed: 7, points: 30 })
    for (let i = 0; i <= 50; i++) expect(a(i / 50)).toBe(b(i / 50)) // byte-identical
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('draws a different curve for a different seed', () => {
    const a = rough({ seed: 7 })
    const c = rough({ seed: 8 })
    const diff = at(a).reduce((sum, y, i) => sum + Math.abs(y - at(c)[i]!), 0)
    expect(diff).toBeGreaterThan(0)
  })

  it('pins the endpoints to 0 and 1 even at high amplitude', () => {
    const e = rough({ seed: 5, amplitude: 0.9 })
    expect(e(0)).toBe(0)
    expect(e(1)).toBe(1)
  })

  it('stepped holds plateaus; smooth interpolates', () => {
    const eq = (ease: (p: number) => number): number => {
      let count = 0
      let prev = ease(0)
      for (let i = 1; i <= 200; i++) {
        const y = ease(i / 200)
        if (y === prev) count++
        prev = y
      }
      return count
    }
    expect(eq(rough({ seed: 2, points: 10 }))).toBeGreaterThan(eq(rough({ seed: 2, points: 10, smooth: true })))
  })
})

describe('string registration', () => {
  it('resolves the procedural eases by string and lands at 0 and 1', () => {
    for (const spec of ['wiggle(6)', 'shake(8)', 'slow(0.75, 0.85)', 'rough(24, 0.3, 7)']) {
      const e = resolveEasing(spec)
      expect(typeof e).toBe('function')
      expect(e(0)).toBeCloseTo(0, 6)
      expect(e(1)).toBeCloseTo(1, 6)
    }
  })

  it('ignores the variant segment (not a family)', () => {
    expect(resolveEasing('wiggle.out(6)')(0.5)).toBe(resolveEasing('wiggle(6)')(0.5))
  })
})
