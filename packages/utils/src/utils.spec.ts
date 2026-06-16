import { describe, expect, it } from 'vitest'
import { clamp, interpolate, mapRange, pipe, random, snap, toArray, wrap } from './utils'

describe('utils', () => {
  it('clamp bounds a value', () => {
    expect(clamp(5, 0, 3)).toBe(3)
    expect(clamp(-1, 0, 3)).toBe(0)
    expect(clamp(2, 0, 3)).toBe(2)
  })

  it('mapRange remaps across ranges (degenerate input -> outMin)', () => {
    expect(mapRange(5, 0, 10, 0, 100)).toBe(50)
    expect(mapRange(0, 0, 0, 2, 8)).toBe(2)
  })

  it('interpolate is linear', () => {
    expect(interpolate(0, 100, 0.25)).toBe(25)
  })

  it('snap to an increment, and to a set of stops', () => {
    expect(snap(10, 23)).toBe(20)
    expect(snap(10, 26)).toBe(30)
    expect(snap([0, 50, 100], 40)).toBe(50)
  })

  it('wrap handles overflow and negatives (angles, carousels)', () => {
    expect(wrap(0, 360, 370)).toBe(10)
    expect(wrap(0, 360, -10)).toBe(350)
    expect(wrap(0, 360, 0)).toBe(0)
  })

  it('random stays in range and picks from an array', () => {
    const value = random(5, 10)
    expect(value).toBeGreaterThanOrEqual(5)
    expect(value).toBeLessThan(10)
    expect(['a', 'b', 'c']).toContain(random(['a', 'b', 'c']))
  })

  it('toArray normalizes nullish to an empty array', () => {
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
  })

  it('pipe composes left to right', () => {
    const f = pipe(
      (n: number) => n + 1,
      (n) => n * 2,
    )
    expect(f(3)).toBe(8)
  })
})
