import { describe, expect, it } from 'vitest'
import { decaySimulation } from './decay'

describe('decaySimulation', () => {
  it('decelerates proportionally to velocity (exponential decay)', () => {
    const sim = decaySimulation({ timeConstant: 1000 }) // tau = 1 s
    expect(sim.acceleration(0, 100)).toBe(-100)
    expect(sim.acceleration(50, -40)).toBe(40)
  })

  it('rests wherever it is once slow enough', () => {
    const sim = decaySimulation({ restSpeed: 1 })
    expect(sim.rest(42, 0.5)).toBe(42)
    expect(sim.rest(42, 3)).toBeNull()
  })

  it('latches into a spring toward a crossed boundary', () => {
    const sim = decaySimulation({ max: 100, bounceStiffness: 500, bounceDamping: 40 })
    // Beyond the edge: pulled back inward.
    expect(sim.acceleration(110, 0)).toBeLessThan(0)
    // Once crossed, the spring stays active even back inside the range -
    // otherwise inward velocity would decay-glide away from the edge.
    expect(sim.acceleration(90, -20)).toBe(-500 * (90 - 100) - 40 * -20)
    expect(sim.rest(100.005, 0.05)).toBe(100)
  })

  it('stays pure decay while within the boundaries', () => {
    const sim = decaySimulation({ max: 100, timeConstant: 1000 })
    expect(sim.acceleration(50, 80)).toBe(-80)
    expect(sim.rest(50, 0.05)).toBe(50)
  })
})
