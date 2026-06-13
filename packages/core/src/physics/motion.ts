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

/**
 * A Motion whose elapsed clock can be repositioned: the seek seam for duration
 * tweens and baked-spring tables. A live spring/decay is NOT seekable - it has
 * no fixed durationS - so simulationMotion stays a plain Motion.
 */
export interface SeekableMotion extends Motion {
  /** Reposition to an absolute elapsed time (seconds); returns the sample there. Next step() continues from it. */
  seek(elapsedS: number): SimulationState
  /** Total elapsed at rest (seconds). Tweens: the duration. Sampled tables: the last entry. */
  readonly durationS: number
}

export function simulationMotion(simulation: Simulation): Motion {
  return {
    step: (state, timestepS) => stepSimulation(simulation, state, timestepS),
    rest: (state) => simulation.rest(state.position, state.velocity),
  }
}
