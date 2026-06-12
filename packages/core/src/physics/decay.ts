import type { ReducedMotionOverride } from '../a11y/config'
import type { Simulation } from './simulation'

export interface DecayOptions {
  /** Per-animation override of the reduced-motion behavior. */
  reducedMotion?: ReducedMotionOverride
  /** Initial velocity in units/s; defaults to the value's current velocity. */
  velocity?: number
  /** Exponential time constant, in ms. Higher = longer glide. Total distance ~ v0 * tau. */
  timeConstant?: number
  /** Rest when |velocity| < restSpeed (units/s). */
  restSpeed?: number
  /** Optional clamp boundary: crossing it turns the glide into a spring toward the edge. */
  min?: number
  max?: number
  bounceStiffness?: number
  bounceDamping?: number
  restDelta?: number
}

export function decaySimulation(options: DecayOptions = {}): Simulation {
  const {
    timeConstant = 325,
    restSpeed = 0.1,
    min,
    max,
    bounceStiffness = 500,
    bounceDamping = 40,
    restDelta = 0.01,
  } = options
  const tauS = timeConstant / 1000

  // Latched: once a boundary is crossed the spring stays in charge, even back
  // inside the range - otherwise inward velocity would decay-glide away from
  // the edge instead of settling on it. One simulation instance per animation.
  let edge: number | null = null
  const checkEdge = (position: number): number | null => {
    if (edge === null) {
      if (min !== undefined && position < min) edge = min
      else if (max !== undefined && position > max) edge = max
    }
    return edge
  }

  return {
    acceleration(position, velocity) {
      const boundary = checkEdge(position)
      if (boundary !== null) return -bounceStiffness * (position - boundary) - bounceDamping * velocity
      return -velocity / tauS
    },
    rest(position, velocity) {
      const boundary = checkEdge(position)
      if (boundary !== null) {
        return Math.abs(velocity) < restSpeed && Math.abs(position - boundary) < restDelta
          ? boundary
          : null
      }
      return Math.abs(velocity) < restSpeed ? position : null
    },
  }
}
