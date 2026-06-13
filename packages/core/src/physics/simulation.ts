/**
 * Fixed simulation timestep (seconds), consumed through an accumulator
 * ("fix your timestep"). Same trajectory at 60/120/144 Hz, testable step
 * by step. Lower it if very stiff springs ever prove unstable - the API
 * does not change.
 */
export const SIMULATION_TIMESTEP_S = 1 / 120

export interface SimulationState {
  position: number
  /** units/s */
  velocity: number
}

/**
 * Every physics mode (spring, decay, inertia...) reduces to an acceleration
 * function plus a rest condition over a (position, velocity) state. This is
 * what makes retargeting and handoff free: the state survives, only the
 * simulation behind it changes.
 */
export interface Simulation {
  /** units/s^2 */
  acceleration(position: number, velocity: number): number
  /** Settled position when the state qualifies as rest, null while moving. */
  rest(position: number, velocity: number): number | null
}

/** One semi-implicit (symplectic) Euler step: velocity first, then position. */
export function stepSimulation(
  simulation: Simulation,
  state: SimulationState,
  timestepS: number,
): SimulationState {
  const velocity =
    state.velocity + simulation.acceleration(state.position, state.velocity) * timestepS
  return { position: state.position + velocity * timestepS, velocity }
}
