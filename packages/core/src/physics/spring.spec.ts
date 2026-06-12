import { describe, expect, it } from 'vitest'
import { springSimulation } from './spring'

describe('springSimulation', () => {
  it('computes damped Hooke acceleration', () => {
    const sim = springSimulation(100, { stiffness: 200, damping: 20, mass: 2 })
    // a = (-k * (x - target) - c * v) / m
    expect(sim.acceleration(50, 30)).toBe((-200 * (50 - 100) - 20 * 30) / 2)
  })

  it('rests only when BOTH position and velocity are within thresholds', () => {
    const sim = springSimulation(100, { restDelta: 0.5, restSpeed: 1 })
    expect(sim.rest(99.9, 0.1)).toBe(100)
    expect(sim.rest(99.9, 5)).toBeNull() // close, but still fast
    expect(sim.rest(90, 0.1)).toBeNull() // slow, but still far
  })
})
