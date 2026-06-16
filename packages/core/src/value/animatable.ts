import { getReducedMotionBehavior, type ReducedMotionOverride } from '../a11y/config'
import { prefersReducedMotion } from '../a11y/reduced-motion'
import { decaySimulation, type DecayOptions } from '../physics/decay'
import { simulationMotion, type Motion } from '../physics/motion'
import { SIMULATION_TIMESTEP_S, type Simulation, type SimulationState } from '../physics/simulation'
import { springSimulation, type SpringOptions } from '../physics/spring'
import { tweenMotion, type ToOptions } from '../physics/tween'
import type { FrameInfo, Scheduler } from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'

export interface AnimationHandle {
  /** Resolves when the animation settles OR is interrupted. Never rejects. */
  readonly finished: Promise<void>
  /** Freezes the value in place - only if this animation is still the active one. */
  stop(): void
}

export interface AnimatableOptions {
  /** Injection point for tests; defaults to the shared rAF scheduler. */
  scheduler?: Scheduler
}

export interface SetOptions {
  /** Seed a velocity (units/s) along with the value - external handoffs (WAAPI reclaim, gestures). */
  velocity?: number
}

export interface SimulateOptions {
  /** Initial velocity (units/s); defaults to the value's current velocity. */
  velocity?: number
  /** Per-animation override of the reduced-motion behavior. */
  reducedMotion?: ReducedMotionOverride
}

export interface Animatable {
  get(): number
  /** units/s */
  velocity(): number
  isAnimating(): boolean
  /** Teleport: cancels any animation; velocity resets to 0 unless seeded. */
  set(value: number, options?: SetOptions): void
  /**
   * Passive write of position+velocity: emits `change`, but does NOT freeze an
   * active animation, fire `rest`, or zero velocity. The playback layer drives
   * a value through this; the value stays a state holder.
   */
  drive(state: SimulationState): void
  /** Freeze in place: position AND velocity stay readable. */
  stop(): void
  /** Retargets from the current position and velocity - interruptible at any time. */
  spring(target: number, options?: SpringOptions): AnimationHandle
  /** Glide on inertia from the current (or imposed) velocity; optional clamp boundaries. */
  decay(options?: DecayOptions): AnimationHandle
  /** Duration/easing escape hatch - still interruptible, with a readable derived velocity. */
  to(target: number, options?: ToOptions): AnimationHandle
  /**
   * Drive the value with a custom Simulation - the general physics mode that
   * spring/decay/to specialize. Runs from the current position and velocity on
   * the same fixed-timestep clock, fully interruptible. Bring your own
   * acceleration (gravity, a force field, a bounce) and rest condition.
   */
  simulate(simulation: Simulation, options?: SimulateOptions): AnimationHandle
  on(event: 'change', listener: (value: number) => void): () => void
  on(event: 'rest', listener: () => void): () => void
  dispose(): void
}

interface ActiveAnimation {
  motion: Motion
  prev: SimulationState
  curr: SimulationState
  accumulatorS: number
  finish(): void
}

const shouldSkip = (override?: ReducedMotionOverride): boolean => {
  if (override === 'allow') return false
  if (override === undefined && getReducedMotionBehavior() === 'allow') return false
  return prefersReducedMotion()
}

// Backstop for motions that never rest (e.g. an undamped spring): give up
// fast-forwarding and settle wherever the simulation stands.
const MAX_SKIP_STEPS = 100_000

export function animatable(initial: number, options: AnimatableOptions = {}): Animatable {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const changeListeners = new Set<(value: number) => void>()
  const restListeners = new Set<() => void>()

  let position = initial
  let velocity = 0
  let active: ActiveAnimation | null = null
  let unsubscribeFrames: (() => void) | null = null

  const emitChange = () => {
    for (const listener of [...changeListeners]) listener(position)
  }

  /** Detach the active animation, resolving its `finished`. State is left as-is. */
  const freeze = () => {
    const animation = active
    if (animation === null) return
    active = null
    unsubscribeFrames?.()
    unsubscribeFrames = null
    animation.finish()
  }

  const onFrame = ({ deltaMs }: FrameInfo) => {
    const animation = active
    if (animation === null) return
    animation.accumulatorS += deltaMs / 1000

    while (animation.accumulatorS >= SIMULATION_TIMESTEP_S) {
      animation.accumulatorS -= SIMULATION_TIMESTEP_S
      animation.prev = animation.curr
      animation.curr = animation.motion.step(animation.curr, SIMULATION_TIMESTEP_S)

      const rested = animation.motion.rest(animation.curr)
      if (rested !== null) {
        position = rested // exact snap on the settle position
        velocity = 0
        freeze()
        emitChange()
        for (const listener of [...restListeners]) listener()
        return
      }
    }

    // The exposed state is interpolated between the two latest simulated
    // steps: jitter-free rendering, and retargets inherit exactly what is
    // visible on screen.
    const alpha = animation.accumulatorS / SIMULATION_TIMESTEP_S
    const previous = position
    position = animation.prev.position + (animation.curr.position - animation.prev.position) * alpha
    velocity = animation.prev.velocity + (animation.curr.velocity - animation.prev.velocity) * alpha
    if (position !== previous) emitChange()
  }

  // Reduced motion (default 'skip'): the animation "runs" instantly - the
  // simulation is fast-forwarded to its rest state in one synchronous pass,
  // so even a decay with boundaries lands exactly where the full glide would.
  const settleInstantly = (motion: Motion, state: SimulationState): AnimationHandle => {
    let current = state
    let settled: number | null = null
    for (let i = 0; i < MAX_SKIP_STEPS && settled === null; i++) {
      current = motion.step(current, SIMULATION_TIMESTEP_S)
      settled = motion.rest(current)
    }
    freeze()
    const previous = position
    position = settled ?? current.position
    velocity = 0
    if (position !== previous) emitChange()
    for (const listener of [...restListeners]) listener()
    return { finished: Promise.resolve(), stop: () => {} }
  }

  const startAnimation = (motion: Motion, state: SimulationState): AnimationHandle => {
    const previous = active
    let resolveFinished = () => {}
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve
    })
    const animation: ActiveAnimation = {
      motion,
      prev: state,
      curr: state,
      accumulatorS: 0,
      finish: () => resolveFinished(),
    }
    active = animation
    velocity = state.velocity
    previous?.finish() // replaced -> resolve, never reject
    unsubscribeFrames ??= scheduler.subscribe(onFrame)
    return {
      finished,
      stop: () => {
        if (active === animation) freeze()
      },
    }
  }

  return {
    get: () => position,
    velocity: () => velocity,
    isAnimating: () => active !== null,
    set(value, setOptions = {}) {
      freeze()
      velocity = setOptions.velocity ?? 0
      if (position !== value) {
        position = value
        emitChange()
      }
    },
    drive(state) {
      velocity = state.velocity
      if (position !== state.position) {
        position = state.position
        emitChange()
      }
    },
    stop: freeze,
    spring(target, springOptions = {}) {
      const motion = simulationMotion(springSimulation(target, springOptions))
      const state = { position, velocity: springOptions.velocity ?? velocity }
      if (shouldSkip(springOptions.reducedMotion)) return settleInstantly(motion, state)
      return startAnimation(motion, state)
    },
    decay(decayOptions = {}) {
      const motion = simulationMotion(decaySimulation(decayOptions))
      const state = { position, velocity: decayOptions.velocity ?? velocity }
      if (shouldSkip(decayOptions.reducedMotion)) return settleInstantly(motion, state)
      return startAnimation(motion, state)
    },
    to(target, toOptions = {}) {
      const motion = tweenMotion(position, target, toOptions)
      const state = { position, velocity }
      if (shouldSkip(toOptions.reducedMotion)) return settleInstantly(motion, state)
      return startAnimation(motion, state)
    },
    simulate(simulation, simulateOptions = {}) {
      const motion = simulationMotion(simulation)
      const state = { position, velocity: simulateOptions.velocity ?? velocity }
      if (shouldSkip(simulateOptions.reducedMotion)) return settleInstantly(motion, state)
      return startAnimation(motion, state)
    },
    on(event: 'change' | 'rest', listener: (value: number) => void) {
      const listeners: Set<(value: number) => void> = event === 'change' ? changeListeners : restListeners
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      freeze()
      changeListeners.clear()
      restListeners.clear()
    },
  }
}
