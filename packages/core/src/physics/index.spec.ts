import { describe, expect, it } from 'vitest'
import { SIMULATION_TIMESTEP_S, stepSimulation } from './index'

describe('@underlying/core/physics barrel', () => {
  it('exposes the timestep and the Euler step for fully manual loops', () => {
    expect(SIMULATION_TIMESTEP_S).toBeGreaterThan(0)
    // a constant downward acceleration over one step: velocity then position
    const next = stepSimulation({ acceleration: () => 1000, rest: () => null }, { position: 0, velocity: 0 }, 0.1)
    expect(next.velocity).toBeCloseTo(100) // 1000 * 0.1
    expect(next.position).toBeCloseTo(10) // semi-implicit: position uses the new velocity (100 * 0.1)
  })
})
