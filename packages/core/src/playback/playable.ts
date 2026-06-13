import { getReducedMotionBehavior, type ReducedMotionOverride } from '../a11y/config'
import { prefersReducedMotion } from '../a11y/reduced-motion'
import { decaySimulation, type DecayOptions } from '../physics/decay'
import { simulationMotion, type Motion, type SeekableMotion } from '../physics/motion'
import { record, sampledMotion } from '../physics/sampled'
import { SIMULATION_TIMESTEP_S, type SimulationState } from '../physics/simulation'
import { springSimulation, type SpringOptions } from '../physics/spring'
import { tweenMotion, type ToOptions } from '../physics/tween'
import type { Scheduler } from '../scheduler/scheduler'
import { getSharedScheduler } from '../scheduler/shared'
import type { Animatable } from '../value/animatable'
import { warnOnce } from '../value/warn'
import type { MotionKind, PlaybackHandle, PlaybackOptions } from './handle'
import { timeScope } from './time-scope'

export interface PlayableOptions {
  /** The scheduler the value runs on; pass the same one the value was created with. Defaults to the shared loop. */
  scheduler?: Scheduler
}

export interface PlaybackValue {
  /** Live spring chase (physics, not seekable until bake()). */
  spring(target: number, options?: SpringOptions & PlaybackOptions): PlaybackHandle
  /** Duration tween (timeline, seekable from birth). */
  to(target: number, options?: ToOptions & PlaybackOptions): PlaybackHandle
  /** Inertial glide (physics, not seekable until bake()). */
  decay(options?: DecayOptions & PlaybackOptions): PlaybackHandle
}

const H = SIMULATION_TIMESTEP_S

const shouldSkip = (override?: ReducedMotionOverride): boolean => {
  if (override === 'allow') return false
  if (override === undefined && getReducedMotionBehavior() === 'allow') return false
  return prefersReducedMotion()
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(Math.max(x, lo), hi)

/** Conditionally-spread the repeat/delay options (exactOptionalPropertyTypes: never assign undefined). */
function repeatConfig(o: PlaybackOptions): Pick<StartConfig, 'delay' | 'repeat' | 'repeatDelay' | 'yoyo'> {
  const c: Pick<StartConfig, 'delay' | 'repeat' | 'repeatDelay' | 'yoyo'> = {}
  if (o.delay !== undefined) c.delay = o.delay
  if (o.repeat !== undefined) c.repeat = o.repeat
  if (o.repeatDelay !== undefined) c.repeatDelay = o.repeatDelay
  if (o.yoyo !== undefined) c.yoyo = o.yoyo
  return c
}

/** Under reduced motion the loop collapses; the final waypoint depends on yoyo parity. */
function reducedFinal(from: number, to: number, o: PlaybackOptions): number {
  const repeat = o.repeat ?? 0
  if (o.yoyo !== true || !Number.isFinite(repeat)) return to
  return (1 + repeat) % 2 === 1 ? to : from
}

// Backstop for a live spring that never rests when reduced motion fast-forwards it.
const MAX_SKIP_STEPS = 100_000

/** Run a motion to rest synchronously; returns the settled state. */
function settleInstantly(motion: Motion, from: SimulationState): SimulationState {
  let current = from
  let settled: number | null = null
  for (let i = 0; i < MAX_SKIP_STEPS && settled === null; i++) {
    current = motion.step(current, H)
    settled = motion.rest(current)
  }
  return { position: settled ?? current.position, velocity: 0 }
}

/** Controls shared by every PlaybackHandle, before the public router wraps them. */
interface RunControls {
  readonly kind: MotionKind
  isSeekable(): boolean
  finished: Promise<void>
  pause(): void
  resume(): void
  isPaused(): boolean
  setTimeScale(rate: number): void
  getTimeScale(): number
  stop(): void
  reverse(): void
  // seekable only:
  seekMs(ms: number): void
  progressGet(): number
  timeMs(): number
  totalMs(): number
  durationMs(): number | undefined
  // live only:
  setTarget(value: number, velocity?: number): void
  bake(maxDurationMs?: number): boolean
}

interface StartConfig {
  value: Animatable
  scheduler: Scheduler
  kind: MotionKind
  state: SimulationState
  paused: boolean
  timeScale: number
  /** Build the live motion for the current target (springs/decay). Absent for a seekable tween. */
  makeLive?: () => Motion
  /** Update the live target (springs) so a rebuild/reverse/bake re-aims correctly. */
  retargetLive?: (target: number) => void
  /** The launch position (springs), for reverse and progress(). */
  launchPos?: number
  /** The initial target (springs), so live progress() spans launch -> target. */
  initialTarget?: number
  /** Whether makeLive() carries latched state (decay): bake must re-walk from the start. */
  stateful?: boolean
  /** The seekable motion (tween/baked). Present iff seekable from birth. */
  seekMotion?: SeekableMotion
  /** ms before the first iteration starts. */
  delay?: number
  /** Iterations beyond the first; Infinity loops forever. */
  repeat?: number
  /** ms of dead time between iterations. */
  repeatDelay?: number
  /** Ping-pong the iterations. */
  yoyo?: boolean
}

function startRun(config: StartConfig): RunControls {
  const { value, kind } = config
  const scope = timeScope({ scheduler: config.scheduler, timeScale: config.timeScale, paused: config.paused })

  // Mode: a live spring/decay drains fixed steps; a seekable tween/table walks a playhead.
  let seekMotion: SeekableMotion | null = config.seekMotion ?? null
  let liveMotion: Motion | null = config.makeLive ? config.makeLive() : null

  // Live accumulator state.
  let prev = config.state
  let curr = config.state
  let accumulatorS = 0
  let liveElapsedS = 0
  const launchPos = config.launchPos ?? config.state.position
  const originalTarget = config.initialTarget ?? launchPos
  let currentTarget = originalTarget

  // Seekable playhead state.
  let elapsedS = 0
  let direction: 1 | -1 = 1
  let durationS = seekMotion?.durationS ?? 0

  // Repeat / delay / yoyo state. Decay has no symmetric start, so it never repeats.
  const canRepeat = seekMotion !== null || config.initialTarget !== undefined
  let iterationsLeft = canRepeat ? (config.repeat ?? 0) : 0
  const repeatDelayS = (config.repeatDelay ?? 0) / 1000
  const yoyo = config.yoyo ?? false
  let holdS = (config.delay ?? 0) / 1000 // initial delay, then reused between iterations
  let forwardLeg = true // live yoyo parity: launch -> target (true) vs target -> launch
  let totalElapsedS = 0

  let settled = false
  let resolveFinished = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })

  let unsubscribe: (() => void) | null = null

  const finish = () => {
    if (settled) return
    settled = true
    unsubscribe?.()
    unsubscribe = null
    scope.dispose()
    resolveFinished()
  }

  // End of one iteration. Either finish, or roll into the next one after an
  // optional repeatDelay. Springs reset to rest at a boundary (a stable
  // discontinuous loop); tweens replay the curve (mirrored for yoyo).
  const onIterationEnd = (boundaryPos: number) => {
    value.drive({ position: boundaryPos, velocity: 0 })
    if (iterationsLeft <= 0) {
      finish()
      return
    }
    iterationsLeft -= 1
    holdS = repeatDelayS
    if (seekMotion !== null) {
      if (yoyo) {
        direction = direction === 1 ? -1 : 1 // play back from this boundary
      } else {
        elapsedS = 0
        direction = 1 // replay from the start
      }
      return
    }
    forwardLeg = yoyo ? !forwardLeg : true
    const start = forwardLeg ? launchPos : originalTarget
    const aim = forwardLeg ? originalTarget : launchPos
    config.retargetLive?.(aim)
    currentTarget = aim
    const seed: SimulationState = { position: start, velocity: 0 }
    prev = seed
    curr = seed
    accumulatorS = 0
    liveElapsedS = 0
    liveMotion = config.makeLive ? config.makeLive() : liveMotion
    value.drive(seed)
  }

  const driveLive = (deltaS: number) => {
    if (liveMotion === null) return
    accumulatorS += deltaS
    while (accumulatorS >= H) {
      accumulatorS -= H
      prev = curr
      curr = liveMotion.step(curr, H)
      liveElapsedS += H
      const rested = liveMotion.rest(curr)
      if (rested !== null) {
        onIterationEnd(rested)
        return
      }
    }
    const alpha = accumulatorS / H
    value.drive({
      position: prev.position + (curr.position - prev.position) * alpha,
      velocity: prev.velocity + (curr.velocity - prev.velocity) * alpha,
    })
  }

  const driveSeek = (deltaS: number) => {
    if (seekMotion === null) return
    elapsedS += deltaS * direction
    if (direction < 0 && elapsedS <= 0) {
      elapsedS = 0
      onIterationEnd(seekMotion.seek(0).position)
      return
    }
    if (direction > 0 && elapsedS >= durationS) {
      elapsedS = durationS
      onIterationEnd(seekMotion.seek(durationS).position)
      return
    }
    const s = seekMotion.seek(elapsedS)
    value.drive(direction < 0 ? { position: s.position, velocity: -s.velocity } : s)
  }

  // A live handle may switch to seekable on bake(), so the branch is chosen per
  // frame rather than captured once. A delay / repeatDelay holds the clock first.
  const frame = ({ deltaMs }: { deltaMs: number }) => {
    const deltaS = deltaMs / 1000
    totalElapsedS += deltaS
    if (holdS > 0) {
      holdS -= deltaS
      return
    }
    if (seekMotion !== null) driveSeek(deltaS)
    else driveLive(deltaS)
  }

  const ensureSubscribed = () => {
    if (unsubscribe === null && !settled) unsubscribe = scope.subscribe(frame)
  }
  ensureSubscribed()

  const liveProgress = (): number => {
    const span = Math.abs(currentTarget - launchPos)
    if (span === 0) return settled ? 1 : 0
    return clamp(Math.abs(value.get() - launchPos) / span, 0, 1)
  }

  return {
    kind,
    isSeekable: () => seekMotion !== null,
    finished,
    pause: () => scope.pause(),
    resume: () => scope.resume(),
    isPaused: () => scope.isPaused(),
    setTimeScale: (rate) => scope.setTimeScale(rate),
    getTimeScale: () => scope.getTimeScale(),
    stop: finish,
    reverse() {
      if (seekMotion !== null) {
        direction = direction === 1 ? -1 : 1
        ensureSubscribed()
        return
      }
      // Live spring: retarget to the launch position, conserving current velocity.
      this.setTarget(launchPos, value.velocity())
    },
    seekMs(ms) {
      if (seekMotion === null) return
      elapsedS = clamp(ms / 1000, 0, durationS)
      const s = seekMotion.seek(elapsedS)
      value.drive(direction < 0 ? { position: s.position, velocity: -s.velocity } : s)
    },
    progressGet() {
      if (settled) return 1
      if (seekMotion !== null) return durationS <= 0 ? 1 : clamp(elapsedS / durationS, 0, 1)
      return liveProgress()
    },
    timeMs: () => (seekMotion !== null ? elapsedS : liveElapsedS) * 1000,
    totalMs: () => totalElapsedS * 1000,
    durationMs: () => (seekMotion !== null ? durationS * 1000 : undefined),
    setTarget(target, velocity) {
      if (seekMotion !== null) return
      currentTarget = target
      config.retargetLive?.(target)
      liveMotion = config.makeLive ? config.makeLive() : liveMotion
      const seed: SimulationState = { position: value.get(), velocity: velocity ?? value.velocity() }
      prev = seed
      curr = seed
      accumulatorS = 0
      value.drive(seed)
      ensureSubscribed()
    },
    bake(maxDurationMs) {
      if (seekMotion !== null) return true // a tween or already-baked handle: idempotent
      if (config.makeLive === undefined) return false
      const make = config.makeLive
      const maxSteps = maxDurationMs === undefined ? undefined : Math.ceil(maxDurationMs / 1000 / H)
      const seed: SimulationState = { position: value.get(), velocity: value.velocity() }
      const recordOptions: { stateful?: boolean; maxSteps?: number } = {}
      if (config.stateful !== undefined) recordOptions.stateful = config.stateful
      if (maxSteps !== undefined) recordOptions.maxSteps = maxSteps
      const trajectory = record(make, seed, recordOptions)
      if (trajectory === null) {
        warnOnce('playback:bake-failed', 'bake() found no rest within the limit; the handle stays live')
        return false
      }
      seekMotion = sampledMotion(trajectory)
      durationS = trajectory.durationS
      elapsedS = 0
      direction = 1
      liveMotion = null
      ensureSubscribed()
      return true
    },
  }
}

/** A settled, inert handle returned under reduced motion (the motion fast-forwarded). */
function inertControls(value: Animatable, kind: MotionKind, settleTo: number): RunControls {
  value.drive({ position: settleTo, velocity: 0 })
  return {
    kind,
    isSeekable: () => true,
    finished: Promise.resolve(),
    pause: () => {},
    resume: () => {},
    isPaused: () => false,
    setTimeScale: () => {},
    getTimeScale: () => 1,
    stop: () => {},
    reverse: () => {},
    seekMs: () => {},
    progressGet: () => 1,
    timeMs: () => 0,
    totalMs: () => 0,
    durationMs: () => 0,
    setTarget: (target) => value.drive({ position: target, velocity: 0 }),
    bake: () => true,
  }
}

/** Wrap RunControls in the public PlaybackHandle, applying the kind-invalid warn-and-no-op policy. */
function buildHandle(controls: RunControls): PlaybackHandle {
  const handle: PlaybackHandle = {
    kind: controls.kind,
    get seekable() {
      return controls.isSeekable()
    },
    finished: controls.finished,
    stop: () => controls.stop(),
    pause() {
      controls.pause()
      return this
    },
    play() {
      controls.resume()
      return this
    },
    resume() {
      controls.resume()
      return this
    },
    isPaused: () => controls.isPaused(),
    timeScale(rate?: number): number | PlaybackHandle {
      if (rate === undefined) return controls.getTimeScale()
      controls.setTimeScale(rate)
      return handle
    },
    reverse() {
      controls.reverse()
      return this
    },
    seek(timeMs: number) {
      if (!controls.isSeekable()) {
        warnOnce('playback:seek-live', 'seek()/progress() need a seekable handle; bake() a spring first')
        return this
      }
      controls.seekMs(timeMs)
      return this
    },
    progress(p?: number): number | PlaybackHandle {
      if (p === undefined) return controls.progressGet()
      if (!controls.isSeekable()) {
        warnOnce('playback:seek-live', 'seek()/progress() need a seekable handle; bake() a spring first')
        return handle
      }
      const duration = controls.durationMs() ?? 0
      controls.seekMs(clamp(p, 0, 1) * duration)
      return handle
    },
    time: () => controls.timeMs(),
    totalTime: () => controls.totalMs(),
    duration: () => controls.durationMs(),
    bake: (options) => controls.bake(options?.maxDurationMs),
    setTarget(value: number, options?: { velocity?: number }) {
      if (controls.isSeekable()) {
        warnOnce('playback:settarget-seekable', 'setTarget() re-aims a live spring; a seekable handle uses seek()')
        return this
      }
      controls.setTarget(value, options?.velocity)
      return this
    },
  } as PlaybackHandle
  return handle
}

export function playable(value: Animatable, options: PlayableOptions = {}): PlaybackValue {
  const scheduler = options.scheduler ?? getSharedScheduler()

  return {
    spring(target, springOptions = {}) {
      const state: SimulationState = {
        position: value.get(),
        velocity: springOptions.velocity ?? value.velocity(),
      }
      if (shouldSkip(springOptions.reducedMotion)) {
        return buildHandle(
          inertControls(value, 'physics', reducedFinal(state.position, target, springOptions)),
        )
      }
      let aim = target
      return buildHandle(
        startRun({
          value,
          scheduler,
          kind: 'physics',
          state,
          paused: springOptions.paused ?? false,
          timeScale: springOptions.timeScale ?? 1,
          makeLive: () => simulationMotion(springSimulation(aim, springOptions)),
          retargetLive: (next) => {
            aim = next
          },
          launchPos: state.position,
          initialTarget: target,
          stateful: false,
          ...repeatConfig(springOptions),
        }),
      )
    },
    decay(decayOptions = {}) {
      const state: SimulationState = {
        position: value.get(),
        velocity: decayOptions.velocity ?? value.velocity(),
      }
      if (shouldSkip(decayOptions.reducedMotion)) {
        const final = settleInstantly(simulationMotion(decaySimulation(decayOptions)), state)
        return buildHandle(inertControls(value, 'physics', final.position))
      }
      return buildHandle(
        startRun({
          value,
          scheduler,
          kind: 'physics',
          state,
          paused: decayOptions.paused ?? false,
          timeScale: decayOptions.timeScale ?? 1,
          makeLive: () => simulationMotion(decaySimulation(decayOptions)),
          launchPos: state.position,
          stateful: true,
        }),
      )
    },
    to(target, toOptions = {}) {
      const from = value.get()
      const motion = tweenMotion(from, target, toOptions)
      if (shouldSkip(toOptions.reducedMotion)) {
        return buildHandle(inertControls(value, 'timeline', reducedFinal(from, target, toOptions)))
      }
      return buildHandle(
        startRun({
          value,
          scheduler,
          kind: 'timeline',
          state: { position: from, velocity: 0 },
          paused: toOptions.paused ?? false,
          timeScale: toOptions.timeScale ?? 1,
          seekMotion: motion,
          ...repeatConfig(toOptions),
        }),
      )
    },
  }
}
