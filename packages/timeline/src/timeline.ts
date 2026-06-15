import type { Animatable, DecayOptions, Easing, Scheduler, SpringOptions, ToOptions } from '@underlying/core'
import { playable, timeScope, type PlaybackHandle, type PlaybackOptions, type TimeScope } from '@underlying/core/playback'
import { build, type BuildResult, type ClipIntent, type Entry, type Op, type StaggerFrom } from './build'
import type { Position } from './position'
import { resolvePosition } from './position'
import { warnOnce } from './warn'

export interface TimelineOptions
  extends Pick<PlaybackOptions, 'repeat' | 'repeatDelay' | 'yoyo' | 'timeScale'> {
  /** Frame loop. Tests inject createScheduler(createManualDriver()). Default the shared rAF loop. */
  scheduler?: Scheduler
  /** Tween defaults merged into every to/from/fromTo clip. */
  defaults?: { duration?: number; easing?: Easing }
  /** Ms inserted before a bare add() with no position. Default 0. */
  defaultGap?: number
  /** Cap for baking a physics child to rest. Default 10_000 ms. */
  maxBakeMs?: number
}

export interface ClipOptions {
  /** Where this clip starts. Default: the timeline end (append). */
  at?: Position
  duration?: number
  easing?: Easing
}
export type SpringClipOptions = ClipOptions & SpringOptions
export type DecayClipOptions = ClipOptions & DecayOptions

export interface StaggerOptions {
  /** Per-item spacing in ms. */
  each: number
  /** Anchor the ripple: 'start' (default), 'end', 'center', or an item index. */
  from?: StaggerFrom
  /** Where the stagger block begins. Default: the timeline end. */
  at?: Position
}

/**
 * The master. It IS a PlaybackHandle (kind:'timeline', seekable:true) plus
 * authoring verbs. The resolved schedule is built (and physics children baked)
 * lazily on the first seek/play/progress/duration, then frozen until the next
 * add() invalidates it. duration() never returns undefined.
 */
export interface Timeline extends PlaybackHandle {
  readonly kind: 'timeline'
  readonly seekable: true
  /** Total ms; never undefined - every child is forced finite at build. */
  duration(): number

  add(child: PlaybackHandle, at?: Position): this
  to(value: Animatable, target: number, options?: ClipOptions): this
  from(value: Animatable, start: number, options?: ClipOptions): this
  fromTo(value: Animatable, start: number, target: number, options?: ClipOptions): this
  spring(value: Animatable, target: number, options?: SpringClipOptions): this
  decay(value: Animatable, options?: DecayClipOptions): this
  /** Fan a builder across items with `each` ms spacing; one child per item. */
  stagger<T>(items: readonly T[], build: (item: T, index: number) => PlaybackHandle, options: StaggerOptions): this
  call(fn: () => void, at?: Position): this
  label(name: string, at?: Position): this
  /** Advance the insertion cursor without adding a clip. */
  shiftCursor(to: Position): this

  /** Resolve a position/label to absolute ms (triggers a build). */
  resolve(position: Position): number
  /** Absolute ms of a label, or undefined. */
  labelTime(name: string): number | undefined
  /** Frozen child layout, for tooling and scroll snap points. */
  layout(): ReadonlyArray<{ start: number; duration: number }>
}

const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)
const atOf = (p?: Position): { at?: Position } => (p === undefined ? {} : { at: p })

// Drive every child to time t. Entries are ascending by start, so on a shared
// value the latest-started clip writes last (last-write-wins). A clip writes
// only once it has started; a not-yet-started clip is skipped UNLESS it is the
// first to touch its value (then it holds the value at that clip's start state).
// Opaque children (add()/nested) own their own values, so they always position.
function seekEntries(entries: readonly Entry[], t: number): void {
  const written = new Set<Animatable>()
  for (const e of entries) {
    if (e.handle === null) continue
    const offset = t - e.startMs
    if (e.value !== null && offset < 0 && written.has(e.value)) continue
    if (offset <= 0) e.handle.seek(0)
    else if (offset >= e.spanMs) e.handle.seek(e.iterationMs)
    else e.handle.seek(offset)
    if (e.value !== null) written.add(e.value)
  }
}

export function createTimeline(options: TimelineOptions = {}): Timeline {
  const ops: Op[] = []
  const defaults = options.defaults ?? {}
  const defaultGap = options.defaultGap ?? 0
  const maxBakeMs = options.maxBakeMs ?? 10_000

  let built: BuildResult | null = null
  let scope: TimeScope | null = null
  let unsubscribe: (() => void) | null = null
  let headMs = 0
  let direction: 1 | -1 = 1
  let done = false
  let delayRemainingMs = 0 // inter-iteration hold for repeatDelay
  const masterRepeat = options.repeat ?? 0
  const masterRepeatDelay = options.repeatDelay ?? 0
  const masterYoyo = options.yoyo ?? false
  let iterationsDone = 0
  let resolveFinished!: () => void
  const finished = new Promise<void>((res) => {
    resolveFinished = res
  })

  const invalidate = (): void => {
    built = null
  }
  const ensureBuilt = (): BuildResult => {
    if (built === null) {
      built = build(ops, { maxBakeMs, defaultGap })
      seekEntries(built.entries, headMs) // leave every value at the head (start) state
    }
    return built
  }
  const seekAll = (t: number): void => seekEntries(ensureBuilt().entries, t)

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

  const fireCalls = (prev: number, head: number): void => {
    if (head <= prev) return // forward-only firing (scrub does not fire calls)
    for (const e of ensureBuilt().entries) {
      if (e.call !== null && e.startMs > prev && e.startMs <= head) e.call()
    }
  }

  const finish = (): void => {
    done = true
    unsubscribe?.()
    unsubscribe = null
    resolveFinished()
  }

  // Reached an end of the timeline. Loop (master repeat/yoyo) or finish.
  const reachedEnd = (durationMs: number): void => {
    if (masterRepeat !== Number.POSITIVE_INFINITY && iterationsDone >= masterRepeat) {
      headMs = direction > 0 ? durationMs : 0
      seekAll(headMs)
      finish()
      return
    }
    iterationsDone += 1
    if (masterYoyo) direction = direction === 1 ? -1 : 1
    headMs = direction > 0 ? 0 : durationMs // start of the next leg
    seekAll(headMs)
    delayRemainingMs = masterRepeatDelay // hold at the leg start before advancing again
  }

  const onFrame = ({ deltaMs }: { deltaMs: number }): void => {
    if (done) return
    const { durationMs } = ensureBuilt()
    let step = deltaMs
    if (delayRemainingMs > 0) {
      delayRemainingMs -= step
      if (delayRemainingMs > 0) return // holding between iterations (repeatDelay)
      step = -delayRemainingMs // spend only the leftover time once the hold elapsed
      delayRemainingMs = 0
    }
    const prev = headMs
    headMs += step * direction
    if (direction > 0 && headMs >= durationMs) {
      fireCalls(prev, durationMs)
      reachedEnd(durationMs)
      return
    }
    if (direction < 0 && headMs <= 0) {
      reachedEnd(durationMs)
      return
    }
    fireCalls(prev, headMs)
    seekAll(headMs)
  }

  const pushClip = (clip: ClipIntent): void => {
    ops.push({ op: 'clip', clip })
    invalidate()
  }
  const tweenOptions = (o: ClipOptions): ToOptions & PlaybackOptions => {
    const out: ToOptions & PlaybackOptions = { paused: true }
    const duration = o.duration ?? defaults.duration
    const easing = o.easing ?? defaults.easing
    if (duration !== undefined) out.duration = duration
    if (easing !== undefined) out.easing = easing
    return out
  }

  const master = {
    kind: 'timeline' as const,
    seekable: true as const,
    finished,

    // --- authoring ---
    add(child: PlaybackHandle, at?: Position) {
      pushClip({ ...atOf(at), handle: child })
      return master
    },
    to(value: Animatable, target: number, o: ClipOptions = {}) {
      const opts = tweenOptions(o)
      pushClip({
        ...atOf(o.at),
        value,
        makeFrom: (pos) => {
          value.set(pos)
          return playable(value).to(target, opts)
        },
      })
      return master
    },
    from(value: Animatable, start: number, o: ClipOptions = {}) {
      const opts = tweenOptions(o)
      pushClip({
        ...atOf(o.at),
        value,
        // tween from `start` to the value's state at this clip's start (prior exit / live)
        makeFrom: (pos) => {
          value.set(start)
          return playable(value).to(pos, opts)
        },
      })
      return master
    },
    fromTo(value: Animatable, start: number, target: number, o: ClipOptions = {}) {
      const opts = tweenOptions(o)
      pushClip({
        ...atOf(o.at),
        value,
        makeFrom: () => {
          value.set(start)
          return playable(value).to(target, opts)
        },
      })
      return master
    },
    spring(value: Animatable, target: number, o: SpringClipOptions = {}) {
      pushClip({
        ...atOf(o.at),
        value,
        makeFrom: (pos, vel) => {
          value.set(pos, { velocity: vel })
          const opts = Object.assign({}, o, { paused: true, velocity: vel }) as SpringOptions & PlaybackOptions
          return playable(value).spring(target, opts)
        },
      })
      return master
    },
    decay(value: Animatable, o: DecayClipOptions = {}) {
      pushClip({
        ...atOf(o.at),
        value,
        makeFrom: (pos, vel) => {
          value.set(pos, { velocity: vel })
          const opts = Object.assign({}, o, { paused: true, velocity: vel }) as DecayOptions & PlaybackOptions
          return playable(value).decay(opts)
        },
      })
      return master
    },
    stagger(items: readonly unknown[], buildFn: (item: unknown, index: number) => PlaybackHandle, o: StaggerOptions) {
      const handles = items.map((item, index) => buildFn(item, index))
      ops.push({
        op: 'stagger',
        handles,
        each: o.each,
        from: o.from ?? 'start',
        ...(o.at !== undefined ? { at: o.at } : {}),
      })
      invalidate()
      return master
    },
    call(fn: () => void, at?: Position) {
      pushClip({ ...atOf(at), call: fn })
      return master
    },
    label(name: string, at?: Position) {
      ops.push({ op: 'label', name, at: at ?? '' })
      invalidate()
      return master
    },
    shiftCursor(to: Position) {
      ops.push({ op: 'cursor', at: to })
      invalidate()
      return master
    },

    // --- introspection ---
    resolve(position: Position) {
      const b = ensureBuilt()
      return resolvePosition(position, {
        cursorMs: b.durationMs,
        prevStartMs: b.durationMs,
        prevEndMs: b.durationMs,
        durationMs: b.durationMs,
        labels: b.labels,
      })
    },
    labelTime(name: string) {
      return ensureBuilt().labels.get(name)
    },
    layout() {
      return ensureBuilt().entries.map((e) => ({ start: e.startMs, duration: e.spanMs }))
    },

    // --- PlaybackHandle: seek/scrub ---
    seek(ms: number) {
      const { durationMs } = ensureBuilt()
      headMs = clamp(ms, 0, durationMs)
      done = false
      iterationsDone = 0
      seekAll(headMs)
      return master
    },
    progress(p?: number) {
      const { durationMs } = ensureBuilt()
      if (p === undefined) return durationMs > 0 ? clamp(headMs / durationMs, 0, 1) : 1
      return master.seek(p * durationMs)
    },
    duration() {
      return ensureBuilt().durationMs
    },
    time() {
      return headMs
    },
    totalTime() {
      return headMs
    },

    // --- PlaybackHandle: live clock ---
    play() {
      ensureBuilt()
      done = false
      const sc = ensureScope()
      seekAll(headMs)
      if (unsubscribe === null) unsubscribe = sc.subscribe(onFrame)
      sc.resume()
      return master
    },
    pause() {
      scope?.pause()
      return master
    },
    resume() {
      return master.play()
    },
    isPaused() {
      return scope?.isPaused() ?? true
    },
    timeScale(rate?: number) {
      const sc = ensureScope()
      if (rate === undefined) return sc.getTimeScale()
      sc.setTimeScale(rate)
      return master
    },
    reverse() {
      direction = direction === 1 ? -1 : 1
      return master.play()
    },

    // --- PlaybackHandle: kind-specific / lifecycle ---
    bake() {
      ensureBuilt()
      return true
    },
    setTarget() {
      warnOnce('timeline:settarget', 'setTarget() re-aims a live spring; a timeline uses seek()')
      return master
    },
    stop() {
      done = true
      unsubscribe?.()
      unsubscribe = null
      scope?.pause()
      resolveFinished()
    },
  }

  return master as unknown as Timeline
}
