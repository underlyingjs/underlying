import { describe, expect, it } from 'vitest'
import { VelocityTracker } from './velocity'

describe('VelocityTracker', () => {
  it('measures velocity in units/s (EMA converges toward the instantaneous rate)', () => {
    const vt = new VelocityTracker()
    vt.start(0, 0)
    vt.sample(10, 100) // 10 units in 100 ms = 100 units/s
    vt.sample(20, 200)
    vt.sample(30, 300)
    const v = vt.read(300)
    expect(v).toBeGreaterThan(50)
    expect(v).toBeLessThanOrEqual(100.001)
  })

  it('returns 0 when the last sample is stale (> 80 ms) - a paused finger does not fling', () => {
    const vt = new VelocityTracker()
    vt.start(0, 0)
    vt.sample(100, 100)
    expect(vt.read(300)).toBe(0)
  })

  it('drops zero / negative dt samples', () => {
    const vt = new VelocityTracker()
    vt.start(0, 0)
    vt.sample(50, 0) // dt = 0 -> ignored
    expect(vt.read(0)).toBe(0)
  })
})
