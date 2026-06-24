import { describe, expect, it } from 'vitest'
import { staggerDelay, staggerDelays } from './stagger-delay'

describe('staggerDelay', () => {
  it('defaults to linear each*i - byte-identical to the original stagger', () => {
    const fn = staggerDelay({ each: 50 })
    expect([0, 1, 2, 3, 4].map((i) => fn(i, 5))).toEqual([0, 50, 100, 150, 200])
  })

  it('adds a flat start lead-in to every delay', () => {
    expect(staggerDelays(3, { each: 40, start: 100 })).toEqual([100, 140, 180])
  })

  it("from 'end' reverses the wave (last item starts first)", () => {
    expect(staggerDelays(5, { each: 50, from: 'end' })).toEqual([200, 150, 100, 50, 0])
  })

  it("from 'center' ripples outward from the middle", () => {
    expect(staggerDelays(5, { each: 50, from: 'center' })).toEqual([100, 50, 0, 50, 100])
  })

  it("from 'edges' ripples inward from both ends", () => {
    expect(staggerDelays(5, { each: 50, from: 'edges' })).toEqual([0, 50, 100, 50, 0])
  })

  it('from a specific index measures distance from it', () => {
    expect(staggerDelays(5, { each: 50, from: 1 })).toEqual([50, 0, 50, 100, 150])
  })

  it('propagates across a 2D grid by Euclidean cell distance', () => {
    // 3x3 grid from the top-left corner; `each` is the delay per unit cell distance.
    const d = staggerDelays(9, { each: 100, grid: { cols: 3 }, from: 'start' })
    expect(d[0]).toBe(0) // (0,0)
    expect(d[8]).toBeCloseTo(Math.hypot(2, 2) * 100, 5) // (2,2): the diagonal corner is the farthest
    expect(d[1]).toBeCloseTo(100, 5) // (1,0): one cell away
    expect(d[2]).toBeCloseTo(200, 5) // (2,0): two cells away
  })

  it('axis restricts a grid wave to one direction', () => {
    // 3x3, axis x from start: rank = column only, so cells in the same column share a delay.
    const d = staggerDelays(9, { each: 100, grid: { cols: 3 }, axis: 'x', from: 'start' })
    expect(d[0]).toBe(d[3]) // (0,0) and (0,1) same column
    expect(d[0]).toBe(d[6]) // (0,2) too
    expect(d[2]).toBeGreaterThan(d[1]!) // column 2 later than column 1
  })

  it('ease redistributes the delays but pins the endpoints', () => {
    const linear = staggerDelays(5, { each: 50 })
    const eased = staggerDelays(5, { each: 50, ease: (t) => t * t }) // ease-in quad
    expect(eased[0]).toBe(linear[0]) // first pinned at start
    expect(eased[4]).toBeCloseTo(linear[4]!, 5) // last pinned at start + max*each
    expect(eased[1]).not.toBeCloseTo(linear[1]!, 1) // middle redistributed
  })

  it('a single item (or fewer) gets only the start lead-in', () => {
    expect(staggerDelay({ each: 50, start: 30 })(0, 1)).toBe(30)
    expect(staggerDelay({ each: 50 })(0, 0)).toBe(0)
  })

  it("'random' is deterministic for a fixed seed and varies across seeds", () => {
    expect(staggerDelays(6, { each: 50, from: 'random', seed: 7 })).toEqual(
      staggerDelays(6, { each: 50, from: 'random', seed: 7 }),
    )
    expect(staggerDelays(6, { each: 50, from: 'random', seed: 1 })).not.toEqual(
      staggerDelays(6, { each: 50, from: 'random', seed: 2 }),
    )
  })

  it('a non-positive grid cols falls back to a flat schedule (no NaN/Infinity)', () => {
    const d = staggerDelays(3, { each: 50, grid: { cols: 0 } })
    expect(d).toEqual([0, 0, 0])
    expect(d.every((n) => Number.isFinite(n))).toBe(true)
  })

  it('clamps an out-of-range origin index into the set', () => {
    // from 99 on 5 items clamps to the last index, equivalent to from 'end'.
    expect(staggerDelays(5, { each: 50, from: 99 })).toEqual([200, 150, 100, 50, 0])
    // a negative index clamps to 0, equivalent to from 'start'.
    expect(staggerDelays(5, { each: 50, from: -3 })).toEqual([0, 50, 100, 150, 200])
  })
})
