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
  /** Rest requires |position - target| < restDelta... */
  restDelta?: number
  /** ...AND |velocity| < restSpeed (units/s). */
  restSpeed?: number
}

/** A spring whose target can be re-aimed in place: no Motion rebuild on a moving target (follow). */
export interface RetargetableSpring extends Simulation {
  retarget(target: number): void
}

export function springSimulation(target: number, options: SpringOptions = {}): RetargetableSpring {
  const { stiffness = 100, damping = 10, mass = 1, restDelta = 0.01, restSpeed = 0.1 } = options
  let aim = target
  return {
    acceleration: (position, velocity) => (-stiffness * (position - aim) - damping * velocity) / mass,
    rest: (position, velocity) =>
      Math.abs(velocity) < restSpeed && Math.abs(position - aim) < restDelta ? aim : null,
    retarget: (next) => {
      aim = next
    },
  }
}
