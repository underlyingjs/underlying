import type { ReducedMotionOverride } from '../a11y/config'
import { easeInOutCubic, type Easing } from './easings'
import type { Motion } from './motion'

export interface ToOptions {
  /** ms */
  duration?: number
  easing?: Easing
  /** Per-animation override of the reduced-motion behavior. */
  reducedMotion?: ReducedMotionOverride
}

/**
 * Duration/easing escape hatch. Sampled on the same fixed-step clock as the
 * physics, with a finite-difference velocity - so even a tween can hand off
 * to a spring mid-flight. Incoming velocity is ignored: a tween is positional
 * control. One instance per animation (it owns its elapsed time).
 */
export function tweenMotion(from: number, to: number, options: ToOptions = {}): Motion {
  const durationS = (options.duration ?? 300) / 1000
  const easing = options.easing ?? easeInOutCubic
  let elapsedS = 0

  return {
    step(state, timestepS) {
      elapsedS += timestepS
      const progress = durationS <= 0 ? 1 : Math.min(elapsedS / durationS, 1)
      const position = progress >= 1 ? to : from + (to - from) * easing(progress)
      return { position, velocity: (position - state.position) / timestepS }
    },
    rest: () => (elapsedS >= durationS ? to : null),
  }
}
