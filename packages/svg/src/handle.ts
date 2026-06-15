import type { Animatable, AnimationHandle, DecayOptions, SpringOptions, ToOptions } from '@underlying/core'

/**
 * The physics verbs every @underlying/svg handle shares. They delegate straight
 * to the live driver Animatable, so a motionPath or a draw is interruptible and
 * retargetable at any moment - the same engine as the rest of core.
 */
export interface ScalarControls {
  /** Spring the driver toward a target (0..1), interruptible, velocity conserved. */
  spring(target: number, options?: SpringOptions): AnimationHandle
  /** Glide on inertia from the current velocity, clamped to 0..1. */
  decay(options?: DecayOptions): AnimationHandle
  /** Duration/easing escape hatch - still interruptible. */
  to(target: number, options?: ToOptions): AnimationHandle
  /** Teleport the driver (no animation). */
  set(value: number): void
  /** Flick: seed a velocity (0..1 units/s) and let it decay to a stop on the path. */
  flick(velocity: number, options?: Omit<DecayOptions, 'velocity'>): AnimationHandle
  /** Freeze in place; position and velocity stay readable. */
  stop(): void
  /** Read the driver, 0..1. */
  progress(): number
  /** Stop, unbind, and restore the element to its pre-bind state. */
  revert(): void
}

/** Build the shared verb surface around a driver value, plus a revert. */
export function scalarControls(value: Animatable, revert: () => void): ScalarControls {
  return {
    spring: (target, options) => value.spring(target, options),
    decay: (options) => value.decay(options),
    to: (target, options) => value.to(target, options),
    set: (next) => value.set(next),
    flick: (velocity, options) => value.decay({ min: 0, max: 1, ...options, velocity }),
    stop: () => value.stop(),
    progress: () => value.get(),
    revert,
  }
}
