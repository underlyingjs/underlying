import type { ReducedMotionOverride } from '../a11y/config'
import { resolveEasing, type EasingInput } from './easing-registry'
import { easeInOutCubic } from './easings'
import type { SeekableMotion } from './motion'
import { SIMULATION_TIMESTEP_S, type SimulationState } from './simulation'

export interface ToOptions {
  /** ms */
  duration?: number
  /** A function, or a named ease by string once @underlying/utils is imported ('power2.out'). */
  easing?: EasingInput
  /** Per-animation override of the reduced-motion behavior. */
  reducedMotion?: ReducedMotionOverride
}

/**
 * Duration/easing escape hatch. Sampled on the same fixed-step clock as the
 * physics, with a finite-difference velocity - so even a tween can hand off
 * to a spring mid-flight. Incoming velocity is ignored: a tween is positional
 * control. Seekable: it owns its elapsed clock, so the playback layer can jump
 * the playhead. One instance per animation.
 */
export function tweenMotion(from: number, to: number, options: ToOptions = {}): SeekableMotion {
  const durationS = (options.duration ?? 300) / 1000
  const easing = resolveEasing(options.easing ?? easeInOutCubic)
  let elapsedS = 0

  const positionAt = (t: number): number => {
    const progress = durationS <= 0 ? 1 : Math.min(Math.max(t, 0) / durationS, 1)
    return progress >= 1 ? to : from + (to - from) * easing(progress)
  }

  return {
    step(state, timestepS) {
      elapsedS += timestepS
      const position = positionAt(elapsedS)
      return { position, velocity: (position - state.position) / timestepS }
    },
    rest: () => (elapsedS >= durationS ? to : null),
    durationS,
    seek(target): SimulationState {
      elapsedS = durationS <= 0 ? durationS : Math.min(Math.max(target, 0), durationS)
      const position = positionAt(elapsedS)
      // Curve derivative via a central finite difference clamped to [0, durationS].
      const hi = Math.min(elapsedS + SIMULATION_TIMESTEP_S, durationS)
      const lo = Math.max(elapsedS - SIMULATION_TIMESTEP_S, 0)
      const span = hi - lo
      const velocity = span > 0 ? (positionAt(hi) - positionAt(lo)) / span : 0
      return { position, velocity }
    },
  }
}
