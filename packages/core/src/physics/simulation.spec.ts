import { describe, expect, it } from 'vitest'
import { SIMULATION_TIMESTEP_S, stepSimulation, type Simulation } from './simulation'

describe('stepSimulation', () => {
  it('integrates semi-implicitly: velocity updates before position', () => {
    const constantAcceleration: Simulation = {
      acceleration: () => 10,
      rest: () => null,
    }
    const next = stepSimulation(constantAcceleration, { position: 0, velocity: 0 }, 0.5)
    expect(next.velocity).toBe(5) // 0 + 10 * 0.5
    expect(next.position).toBe(2.5) // 0 + 5 * 0.5 - explicit Euler would give 0
  })

  it('uses the validated 1/120 s fixed timestep', () => {
    expect(SIMULATION_TIMESTEP_S).toBeCloseTo(1 / 120, 12)
  })
})
