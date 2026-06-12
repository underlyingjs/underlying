import { stepSimulation, type Simulation, type SimulationState } from './simulation'

/**
 * What the Animatable actually drives: anything that advances a
 * (position, velocity) state by fixed timesteps and knows when it is done.
 * Physics modes wrap a Simulation; the duration/easing escape hatch samples
 * a curve instead - same state shape, so handoff between modes is free.
 */
export interface Motion {
  step(state: SimulationState, timestepS: number): SimulationState
  /** Settled position when the state qualifies as rest, null while moving. */
  rest(state: SimulationState): number | null
}

export function simulationMotion(simulation: Simulation): Motion {
  return {
    step: (state, timestepS) => stepSimulation(simulation, state, timestepS),
    rest: (state) => simulation.rest(state.position, state.velocity),
  }
}
