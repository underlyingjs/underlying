import type { ThenFn } from '../value/thenable'
import type { DecayOptions } from '../physics/decay'
import type { SpringOptions } from '../physics/spring'
import type { ToOptions } from '../physics/tween'
import type { FrameInfo, Scheduler } from '../scheduler/scheduler'
import type { Animatable, AnimationHandle } from '../value/animatable'
import type { PlaybackOptions } from './handle'
import { playable } from './playable'
import { timeScope, type TimeScope } from './time-scope'

export interface SequenceOptions extends Pick<PlaybackOptions, 'timeScale' | 'paused'> {
  /** Frame loop. Tests inject createScheduler(createManualDriver()). Default the shared rAF loop. */
  scheduler?: Scheduler
  /** Spring/tween knobs merged into every leg (a leg's own options win). */
  defaults?: SpringOptions & ToOptions
}

/** Where a leg starts relative to the previous one - the only positioning a live sequence has. */
export interface LegOptions {
  /**
   * Start this leg `overlap` ms after the PREVIOUS leg STARTED - the cascade
   * feel, springs handing off mid-flight. Omitted: start when the previous leg
   * comes to rest (strict order).
   */
  overlap?: number
}
export type SpringLegOptions = LegOptions & SpringOptions
export type ToLegOptions = LegOptions & ToOptions
export type DecayLegOptions = LegOptions & DecayOptions
export interface StaggerLegOptions extends LegOptions {
  /** Per-item spacing in ms. */
  each: number
}

/**
 * The live twin of a timeline. Legs run in authored order on completion events
 * (no master clock): each starts when the previous rests, or `overlap` ms after
 * it starts. Every leg is a live spring/decay/tween, so a value stays
 * interruptible - retarget it mid-flight and the motion hands off with its
 * velocity conserved, never a restart. It is deliberately NOT seekable: no
 * seek(), progress() or duration() - that is what `timeline()` is for. Author
 * with from()/fromTo() to make a run replayable (they reset the start each play).
 */
export interface Sequence {
  readonly kind: 'sequence'
  readonly seekable: false
  /** Resolves when the last leg rests (or on stop()). Never rejects. */
  readonly finished: Promise<void>
  /** Awaitable: `await sequence` resolves when the current run finishes (delegates to `finished`). */
  then: ThenFn

  spring(value: Animatable, target: number, options?: SpringLegOptions): this
  to(value: Animatable, target: number, options?: ToLegOptions): this
  from(value: Animatable, start: number, options?: ToLegOptions): this
  fromTo(value: Animatable, start: number, target: number, options?: ToLegOptions): this
  decay(value: Animatable, options?: DecayLegOptions): this
  /** Run an arbitrary handle as a leg. It keeps its own clock - pause/timeScale do not reach it. */
  add(step: () => AnimationHandle, options?: LegOptions): this
  /** Fire a callback at this point in the chain. */
  call(fn: () => void, options?: LegOptions): this
  /** Fan a builder across items `each` ms apart, run as one leg. */
  stagger<T>(items: readonly T[], build: (item: T, index: number) => AnimationHandle, options: StaggerLegOptions): this

  /** Start (or restart from the top), or resume after pause(). */
  play(): this
  pause(): this
  resume(): this
  /** Freeze running legs, cancel pending ones, resolve finished. */
  stop(): void
  isPaused(): boolean
  timeScale(rate: number): this
  timeScale(): number
}

type LegHandle = { finished: Promise<void>; stop: () => void }
interface Leg {
  /** ms after the previous leg's START, or null to wait for the previous leg's REST. */
  overlap: number | null
  /** The driven value, for same-value hand-off; null for call()/add()/stagger(). */
  value: Animatable | null
  start: () => LegHandle
}

// A frame-clock delay (clamped, batched into the loop) - never setTimeout, so a
// background tab pauses overlaps like everything else. Runs on the sequence scope.
const wait = (ms: number, scheduler: Scheduler, onDone: () => void): (() => void) => {
  let elapsedMs = 0
  const unsubscribe = scheduler.subscribe(({ deltaMs }: FrameInfo) => {
    elapsedMs += deltaMs
    if (elapsedMs >= ms) {
      unsubscribe()
      onDone()
    }
  })
  return unsubscribe
}

export function createSequence(options: SequenceOptions = {}): Sequence {
  const legs: Leg[] = []
  const defaults = options.defaults ?? {}

  let scope: TimeScope | null = null
  let phase: 'idle' | 'running' | 'paused' | 'done' = 'idle'
  let startedCount = 0
  let doneCount = 0
  const active = new Set<LegHandle>()
  const activeByValue = new Map<Animatable, LegHandle>()
  const cancels = new Set<() => void>()

  let resolveFinished: () => void = () => {}
  let finishedPromise = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })

  const ensureScope = (): TimeScope => {
    if (scope === null) {
      const opts: { scheduler?: Scheduler; timeScale: number; paused: boolean } = {
        timeScale: options.timeScale ?? 1,
        paused: true,
      }
      if (options.scheduler !== undefined) opts.scheduler = options.scheduler
      scope = timeScope(opts)
    }
    return scope
  }

  // Merge defaults under a leg's own options, and drop the overlap field before
  // the options reach playable (which has no concept of it).
  const legOptions = <T>(o: LegOptions & T): T => {
    const merged = { ...defaults, ...o } as Record<string, unknown>
    if ('overlap' in merged) delete merged.overlap
    return merged as T
  }
  const overlapOf = (o: LegOptions): number | null => (o.overlap === undefined ? null : o.overlap)

  const tryFinish = (): void => {
    if (phase !== 'running') return
    if (startedCount >= legs.length && doneCount >= legs.length) {
      phase = 'done'
      scope?.pause()
      resolveFinished()
    }
  }

  const startLeg = (i: number): void => {
    if (phase !== 'running' || i !== startedCount) return // serialize starts
    const leg = legs[i]
    if (leg === undefined) return
    startedCount = i + 1

    // Same-value hand-off: a new leg takes a value over from the prior leg's
    // live position AND velocity (playable re-seeds from value.velocity()).
    if (leg.value !== null) {
      const prior = activeByValue.get(leg.value)
      if (prior !== undefined) {
        prior.stop() // does not write the value, so the new leg inherits its live state
        active.delete(prior)
        activeByValue.delete(leg.value)
      }
    }

    const handle = leg.start()
    active.add(handle)
    if (leg.value !== null) activeByValue.set(leg.value, handle)

    let counted = false
    void handle.finished.then(() => {
      if (counted) return
      counted = true
      active.delete(handle)
      if (leg.value !== null && activeByValue.get(leg.value) === handle) activeByValue.delete(leg.value)
      doneCount += 1
      tryFinish()
    })

    const next = legs[i + 1]
    if (next === undefined) {
      tryFinish()
      return
    }
    if (next.overlap !== null) cancels.add(wait(next.overlap, ensureScope(), () => startLeg(i + 1)))
    else void handle.finished.then(() => startLeg(i + 1))
  }

  const beginRun = (): void => {
    startedCount = 0
    doneCount = 0
    active.clear()
    activeByValue.clear()
    for (const cancel of cancels) cancel()
    cancels.clear()
    if (legs.length === 0) {
      phase = 'done'
      resolveFinished()
      return
    }
    phase = 'running'
    ensureScope().resume()
    startLeg(0)
  }

  const seq = {
    kind: 'sequence' as const,
    seekable: false as const,
    get finished() {
      return finishedPromise
    },
    then(
      onfulfilled?: ((value: void) => unknown) | null,
      onrejected?: ((reason: unknown) => unknown) | null,
    ): Promise<unknown> {
      return finishedPromise.then(onfulfilled ?? undefined, onrejected ?? undefined)
    },

    spring(value: Animatable, target: number, o: SpringLegOptions = {}) {
      legs.push({
        overlap: overlapOf(o),
        value,
        start: () => playable(value, { scheduler: ensureScope() }).spring(target, legOptions(o)),
      })
      return seq
    },
    to(value: Animatable, target: number, o: ToLegOptions = {}) {
      legs.push({
        overlap: overlapOf(o),
        value,
        start: () => playable(value, { scheduler: ensureScope() }).to(target, legOptions(o)),
      })
      return seq
    },
    from(value: Animatable, start: number, o: ToLegOptions = {}) {
      legs.push({
        overlap: overlapOf(o),
        value,
        start: () => {
          const dest = value.get()
          value.set(start)
          return playable(value, { scheduler: ensureScope() }).to(dest, legOptions(o))
        },
      })
      return seq
    },
    fromTo(value: Animatable, start: number, target: number, o: ToLegOptions = {}) {
      legs.push({
        overlap: overlapOf(o),
        value,
        start: () => {
          value.set(start)
          return playable(value, { scheduler: ensureScope() }).to(target, legOptions(o))
        },
      })
      return seq
    },
    decay(value: Animatable, o: DecayLegOptions = {}) {
      legs.push({
        overlap: overlapOf(o),
        value,
        start: () => playable(value, { scheduler: ensureScope() }).decay(legOptions(o)),
      })
      return seq
    },
    add(step: () => AnimationHandle, o: LegOptions = {}) {
      legs.push({
        overlap: overlapOf(o),
        value: null,
        start: () => {
          const handle = step()
          return { finished: handle.finished, stop: () => handle.stop() }
        },
      })
      return seq
    },
    call(fn: () => void, o: LegOptions = {}) {
      legs.push({
        overlap: overlapOf(o),
        value: null,
        start: () => {
          fn()
          return { finished: Promise.resolve(), stop: () => {} }
        },
      })
      return seq
    },
    stagger(items: readonly unknown[], build: (item: unknown, index: number) => AnimationHandle, o: StaggerLegOptions) {
      legs.push({
        overlap: overlapOf(o),
        value: null,
        start: () => {
          const made: AnimationHandle[] = []
          const itemCancels: Array<() => void> = []
          let remaining = items.length
          let resolveAll: () => void = () => {}
          const finished = items.length === 0 ? Promise.resolve() : new Promise<void>((r) => {
            resolveAll = r
          })
          const startItem = (item: unknown, index: number): void => {
            const handle = build(item, index)
            made.push(handle)
            void handle.finished.then(() => {
              remaining -= 1
              if (remaining === 0) resolveAll()
            })
          }
          items.forEach((item, index) => {
            const delay = o.each * index
            if (delay <= 0) startItem(item, index)
            else itemCancels.push(wait(delay, ensureScope(), () => startItem(item, index)))
          })
          return {
            finished,
            stop: () => {
              for (const cancel of itemCancels) cancel()
              for (const handle of made) handle.stop()
            },
          }
        },
      })
      return seq
    },

    play() {
      if (phase === 'running') return seq
      if (phase === 'paused') {
        phase = 'running'
        scope?.resume()
        return seq
      }
      // idle or done: a fresh run from the top, with a fresh finished promise
      finishedPromise = new Promise<void>((resolve) => {
        resolveFinished = resolve
      })
      beginRun()
      return seq
    },
    pause() {
      if (phase === 'running') {
        phase = 'paused'
        scope?.pause()
      }
      return seq
    },
    resume() {
      return seq.play()
    },
    isPaused() {
      return scope?.isPaused() ?? true
    },
    stop() {
      for (const cancel of cancels) cancel()
      cancels.clear()
      for (const handle of active) handle.stop()
      active.clear()
      activeByValue.clear()
      phase = 'done'
      scope?.pause()
      resolveFinished()
    },
    timeScale(rate?: number) {
      const sc = ensureScope()
      if (rate === undefined) return sc.getTimeScale()
      sc.setTimeScale(rate)
      return seq
    },
  }

  return seq as unknown as Sequence
}
