import type { ReducedMotionOverride } from '../a11y/config'
import type { Simulation } from './simulation'

export interface SpringOptions {
  /** Per-animation override of the reduced-motion behavior. */
  reducedMotion?: ReducedMotionOverride
  stiffness?: number
  damping?: number
  mass?: number
  /** Initial velocity in units/s - handoff from a gesture (drag -> release). */
  velocity?: number
  /** Rest requires |position - target| < restDelta… */
  restDelta?: number
  /** …AND |velocity| < restSpeed (units/s). */
  restSpeed?: number
}

export function springSimulation(target: number, options: SpringOptions = {}): Simulation {
  const { stiffness = 100, damping = 10, mass = 1, restDelta = 0.01, restSpeed = 0.1 } = options
  return {
    acceleration: (position, velocity) =>
      (-stiffness * (position - target) - damping * velocity) / mass,
    rest: (position, velocity) =>
      Math.abs(velocity) < restSpeed && Math.abs(position - target) < restDelta ? target : null,
  }
}
