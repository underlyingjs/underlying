import { getReducedMotionBehavior, type ReducedMotionOverride } from '../a11y/config'
import { prefersReducedMotion } from '../a11y/reduced-motion'
import { decaySimulation, type DecayOptions } from '../physics/decay'
import { simulationMotion, type Motion } from '../physics/motion'
import { SIMULATION_TIMESTEP_S, type Simulation, type SimulationState } from '../physics/simulation'
import { springSimulation, type SpringOptions } from '../physics/spring'
import { tweenMotion, type ToOptions } from '../physics/tween'
import type { FrameInfo, Scheduler } from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'
import { lifecycleRegistry, type LifecycleCallbacks, type LifecycleEvent, type LifecycleRegistry } from './lifecycle'

export interface AnimationHandle {
  /** Resolves when the animation settles OR is interrupted. Never rejects. */
  readonly finished: Promise<void>
  /** Freezes the value in place - only if this animation is still the active one. */
  stop(): void
  /**
   * Attach or (with `null`) replace a lifecycle callback after creation; last writer wins per event.
   * Present on the handles that carry a lifecycle (spring/to/decay/simulate, playable, animate); use
   * `?.` on a handle whose source may not (a composed/keyframe aggregate). Callbacks passed in the
   * call always fire regardless.
   */
  eventCallback?(event: LifecycleEvent, fn: ((handle: AnimationHandle) => void) | null): AnimationHandle
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
  spring(target: number, options?: SpringOptions & LifecycleCallbacks<AnimationHandle>): AnimationHandle
  /** Glide on inertia from the current (or imposed) velocity; optional clamp boundaries. */
  decay(options?: DecayOptions & LifecycleCallbacks<AnimationHandle>): AnimationHandle
  /** Duration/easing escape hatch - still interruptible, with a readable derived velocity. */
  to(target: number, options?: ToOptions & LifecycleCallbacks<AnimationHandle>): AnimationHandle
  /**
   * Drive the value with a custom Simulation - the general physics mode that
   * spring/decay/to specialize. Runs from the current position and velocity on
   * the same fixed-timestep clock, fully interruptible. Bring your own
   * acceleration (gravity, a force field, a bounce) and rest condition.
   */
  simulate(simulation: Simulation, options?: SimulateOptions & LifecycleCallbacks<AnimationHandle>): AnimationHandle
  on(event: 'change', listener: (value: number) => void): () => void
  on(event: 'rest', listener: () => void): () => void
  dispose(): void
}

interface ActiveAnimation {
  motion: Motion
  prev: SimulationState
  curr: SimulationState
  accumulatorS: number
  registry: LifecycleRegistry<AnimationHandle>
  handle: AnimationHandle
  /** True once onStart has fired - so a run replaced before it ever started emits nothing (re-entrancy safety). */
  started: boolean
  /** Resolve `finished`; on an interrupt also fire onInterrupt (onComplete is fired at the rest site). */
  finish(reason: 'complete' | 'interrupt'): void
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
  const freeze = (reason: 'complete' | 'interrupt') => {
    const animation = active
    if (animation === null) return
    active = null
    unsubscribeFrames?.()
    unsubscribeFrames = null
    animation.finish(reason)
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
        const before = position
        position = rested // exact snap on the settle position
        velocity = 0
        freeze('complete')
        emitChange()
        if (position !== before) animation.registry.fire('update', animation.handle, position) // update only on a real change
        for (const listener of [...restListeners]) listener()
        animation.registry.fire('complete', animation.handle, position)
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
    if (position !== previous) {
      emitChange()
      animation.registry.fire('update', animation.handle, position)
    }
  }

  // Reduced motion (default 'skip'): the animation "runs" instantly - the
  // simulation is fast-forwarded to its rest state in one synchronous pass,
  // so even a decay with boundaries lands exactly where the full glide would.
  const settleInstantly = (
    motion: Motion,
    state: SimulationState,
    lifecycle?: LifecycleCallbacks<AnimationHandle>,
  ): AnimationHandle => {
    const registry = lifecycleRegistry<AnimationHandle>()
    registry.seed(lifecycle)
    const handle: AnimationHandle = {
      finished: Promise.resolve(),
      stop: () => {},
      eventCallback(event, fn) {
        registry.set(event, fn)
        return handle
      },
    }
    freeze('interrupt') // any in-flight animation is replaced by this instant settle
    registry.fire('start', handle, position)
    let current = state
    let settled: number | null = null
    for (let i = 0; i < MAX_SKIP_STEPS && settled === null; i++) {
      current = motion.step(current, SIMULATION_TIMESTEP_S)
      settled = motion.rest(current)
    }
    const previous = position
    position = settled ?? current.position
    velocity = 0
    if (position !== previous) {
      emitChange()
      registry.fire('update', handle, position)
    }
    for (const listener of [...restListeners]) listener()
    registry.fire('complete', handle, position)
    return handle
  }

  const startAnimation = (
    motion: Motion,
    state: SimulationState,
    lifecycle?: LifecycleCallbacks<AnimationHandle>,
  ): AnimationHandle => {
    const previous = active
    let resolveFinished = () => {}
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve
    })
    const registry = lifecycleRegistry<AnimationHandle>()
    registry.seed(lifecycle)
    const animation: ActiveAnimation = {
      motion,
      prev: state,
      curr: state,
      accumulatorS: 0,
      registry,
      handle: null as unknown as AnimationHandle, // assigned just below
      started: false,
      finish(reason) {
        resolveFinished()
        // Only a run that actually started can be interrupted (skips a run replaced re-entrantly before its start).
        if (reason === 'interrupt' && this.started) registry.fire('interrupt', this.handle)
      },
    }
    const handle: AnimationHandle = {
      finished,
      stop: () => {
        if (active === animation) freeze('interrupt')
      },
      eventCallback(event, fn) {
        registry.set(event, fn)
        return handle
      },
    }
    animation.handle = handle
    active = animation
    velocity = state.velocity
    previous?.finish('interrupt') // replaced -> resolve + fire the prior run's onInterrupt
    unsubscribeFrames ??= scheduler.subscribe(onFrame)
    // Only fire start if still active - an onInterrupt above may have re-entrantly replaced us.
    if (active === animation) {
      animation.started = true
      registry.fire('start', handle, position)
    }
    return handle
  }

  return {
    get: () => position,
    velocity: () => velocity,
    isAnimating: () => active !== null,
    set(value, setOptions = {}) {
      freeze('interrupt')
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
    stop: () => freeze('interrupt'),
    spring(target, springOptions = {}) {
      const motion = simulationMotion(springSimulation(target, springOptions))
      const state = { position, velocity: springOptions.velocity ?? velocity }
      if (shouldSkip(springOptions.reducedMotion)) return settleInstantly(motion, state, springOptions)
      return startAnimation(motion, state, springOptions)
    },
    decay(decayOptions = {}) {
      const motion = simulationMotion(decaySimulation(decayOptions))
      const state = { position, velocity: decayOptions.velocity ?? velocity }
      if (shouldSkip(decayOptions.reducedMotion)) return settleInstantly(motion, state, decayOptions)
      return startAnimation(motion, state, decayOptions)
    },
    to(target, toOptions = {}) {
      const motion = tweenMotion(position, target, toOptions)
      const state = { position, velocity }
      if (shouldSkip(toOptions.reducedMotion)) return settleInstantly(motion, state, toOptions)
      return startAnimation(motion, state, toOptions)
    },
    simulate(simulation, simulateOptions = {}) {
      const motion = simulationMotion(simulation)
      const state = { position, velocity: simulateOptions.velocity ?? velocity }
      if (shouldSkip(simulateOptions.reducedMotion)) return settleInstantly(motion, state, simulateOptions)
      return startAnimation(motion, state, simulateOptions)
    },
    on(event: 'change' | 'rest', listener: (value: number) => void) {
      const listeners: Set<(value: number) => void> = event === 'change' ? changeListeners : restListeners
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      freeze('interrupt')
      changeListeners.clear()
      restListeners.clear()
    },
  }
}
