import type { Motion, SeekableMotion } from './motion'
import { SIMULATION_TIMESTEP_S, type SimulationState } from './simulation'

/**
 * Upper bound on how many fixed steps a single cold seek re-walks before it
 * yields a sample, and the cap on the checkpoint stride. Bounds the synchronous
 * cost of reconstructing a state far from a checkpoint. Only the record/bake
 * paths consult it; the onFrame accumulator hot path is untouched.
 */
export const MAX_STEPS_PER_FRAME = 240

// Backstop for a motion that never rests (an undamped spring): give up
// discovering a duration rather than spin forever.
const MAX_RECORD_STEPS = 100_000

const H = SIMULATION_TIMESTEP_S

export interface Trajectory {
  /** Total elapsed at rest (seconds): the step where the simulation first rested, times H. */
  readonly durationS: number
  /**
   * Exposed (position, velocity) at absolute elapsed time (seconds), clamped to
   * [0, durationS]. Reproduces the live animatable's one-step-trailing
   * interpolation, so a baked clip scrubs to the exact pixels a live run showed.
   */
  sample(elapsedS: number): SimulationState
}

export interface RecordOptions {
  /** Checkpoint stride in steps. Default 64, clamped to MAX_STEPS_PER_FRAME. Bounds cold-seek re-walk for stateless motions. */
  checkpointStride?: number
  /**
   * The motion carries latched state (a decay edge, a tween clock) that a
   * mid-trajectory state cannot resume from: rebuild makeMotion() and re-walk
   * from the start on every cold seek so that state re-forms identically.
   */
  stateful?: boolean
  /** Steps before record gives up (the motion never rests). Default 100_000. */
  maxSteps?: number
}

/**
 * Run the 1/120 s simulation once to discover its duration and a sparse
 * checkpoint table. Pure: no scheduler, no time source. Returns null when the
 * motion never rests within maxSteps (the bake-failure path).
 */
export function record(
  makeMotion: () => Motion,
  initial: SimulationState,
  options: RecordOptions = {},
): Trajectory | null {
  const stride = Math.max(1, Math.min(options.checkpointStride ?? 64, MAX_STEPS_PER_FRAME))
  const stateful = options.stateful ?? false
  const maxSteps = options.maxSteps ?? MAX_RECORD_STEPS

  // A single reusable motion for the forward walk and (when stateless) for
  // checkpoint-seeded reconstruction. Stateful motions get a fresh one per seek.
  const probe = makeMotion()
  const checkpoints: SimulationState[] = [initial] // checkpoints[i] = state after i*stride steps
  let state = initial
  let restStep = -1
  let restedPosition = initial.position

  for (let step = 1; step <= maxSteps; step++) {
    state = probe.step(state, H)
    if (step % stride === 0) checkpoints.push(state)
    const rested = probe.rest(state)
    if (rested !== null) {
      restStep = step
      restedPosition = rested
      break
    }
  }
  if (restStep === -1) return null

  const durationS = restStep * H
  const restState: SimulationState = { position: restedPosition, velocity: 0 }

  // Exact (position, velocity) after `targetStep` fixed steps. Stateless motions
  // resume from the nearest checkpoint; stateful ones rebuild and re-walk from
  // the start so the latched edge re-latches at the same step.
  const stateAfter = (targetStep: number): SimulationState => {
    if (targetStep <= 0) return initial
    if (targetStep >= restStep) return restState
    if (stateful) {
      const motion = makeMotion()
      let s = initial
      for (let i = 0; i < targetStep; i++) s = motion.step(s, H)
      return s
    }
    const base = Math.min(Math.floor(targetStep / stride), checkpoints.length - 1)
    let s = checkpoints[base] ?? initial
    for (let i = base * stride; i < targetStep; i++) s = probe.step(s, H)
    return s
  }

  return {
    durationS,
    sample(elapsedS) {
      if (elapsedS <= 0) return initial
      if (elapsedS >= durationS) return restState
      const q = elapsedS / H
      const n = Math.floor(q)
      const alpha = q - n
      // The exposed value trails one step (the animatable interpolates between
      // the two latest simulated steps), so the window is [S_{n-1}, S_n].
      const lo = stateAfter(n - 1)
      const hi = stateAfter(n)
      return {
        position: lo.position + (hi.position - lo.position) * alpha,
        velocity: lo.velocity + (hi.velocity - lo.velocity) * alpha,
      }
    },
  }
}

/**
 * A SeekableMotion backed by a recorded trajectory. Owns its elapsed clock so
 * the playback layer can jump the playhead; step() advances it, rest() reports
 * the settle once the duration is reached.
 */
export function sampledMotion(trajectory: Trajectory): SeekableMotion {
  let elapsedS = 0
  return {
    step(_state, timestepS) {
      elapsedS += timestepS
      return trajectory.sample(elapsedS)
    },
    rest: () => (elapsedS >= trajectory.durationS ? trajectory.sample(trajectory.durationS).position : null),
    durationS: trajectory.durationS,
    seek(target): SimulationState {
      elapsedS = Math.min(Math.max(target, 0), trajectory.durationS)
      return trajectory.sample(elapsedS)
    },
  }
}
