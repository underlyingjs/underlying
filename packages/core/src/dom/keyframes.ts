import type { EasingInput } from '../physics/easing-registry'
import type { Easing } from '../physics/easings'
import type { AnimationHandle } from '../value/animatable'

/**
 * One expressive keyframe stop: a value plus an optional position and the easing
 * of the segment REACHING it. `at` is a 0..1 fraction of the total duration
 * (tween mode); `ease` overrides the animation easing for that one segment. A
 * bare value is shorthand for `{ value }`. `null` at index 0 means "from the
 * current value"; a `null` later HOLDS the previous value (a dwell).
 *
 * `at` positions a waypoint in time (WAAPI-consistent): an `at` on the LAST
 * waypoint means the final value is reached at that fraction and then held to the
 * end of the duration - a settle-and-dwell, not the full-duration default.
 */
export interface KeyframeStop<V> {
  value: V | null
  /** 0..1 position along the total duration where this stop is reached (tween mode). Non-decreasing. */
  at?: number
  /** Easing of the segment reaching this stop (tween mode); defaults to the animation easing. */
  ease?: EasingInput
}

/** A keyframe entry: a bare value, `null` (from-current / hold), or an expressive stop. */
export type KeyframeInput<V> = V | null | KeyframeStop<V>

/**
 * Keyframe semantics, shared by numeric channels and registry property groups.
 * Without a duration the waypoints are CHAINED SPRINGS: spring to waypoint k,
 * and only once it has rested (exact snap) spring to k+1 - the honest physics
 * of "spring through a list of targets" (positions/per-segment easing are
 * tween-only and ignored here). With a duration they become a piecewise tween;
 * the duration is split by the stops' positions (evenly when unset) and each
 * segment eases with its own easing (the animation easing when unset). A new
 * animate() interrupts the chain (velocity conserved into the replacement);
 * stop() freezes the running segment and drops the rest. Never rejects.
 */
export interface ChainOps<T> {
  /** Teleport to a value (explicit keyframe-0 start), velocity 0. */
  teleport(target: T): void
  spring(target: T): AnimationHandle
  tween(target: T, durationMs: number, easing: Easing): AnimationHandle
  /** Reduced-motion: settle directly onto the final waypoint. */
  settle(target: T): void
}

export interface ChainConfig {
  duration?: number
  easing: Easing
  reduced: boolean
  /** Per-waypoint segment duration in ms (tween mode); overrides the even split where present. */
  segmentDurations?: number[]
  /** Per-waypoint easing (tween mode); overrides `easing` for that segment where defined. */
  segmentEasings?: ReadonlyArray<Easing | undefined>
}

export interface KeyframeChain {
  handle: AnimationHandle
  /** A new animate() took over this channel: stop advancing and resolve (do not freeze - the replacement owns it now). */
  interrupt(): void
}

export interface NormalizedKeyframes<V> {
  /** undefined = start from the current value+velocity; otherwise a teleport start. */
  teleport: V | undefined
  waypoints: V[]
  /** Per-waypoint 0..1 arrival position; undefined = auto (even split). Aligned to `waypoints`. */
  offsets: ReadonlyArray<number | undefined>
  /** Per-waypoint easing input reaching it; undefined = the animation easing. Aligned to `waypoints`. */
  eases: ReadonlyArray<EasingInput | undefined>
}

const isStop = <V>(entry: KeyframeInput<V>): entry is KeyframeStop<V> =>
  entry !== null && typeof entry === 'object' && !Array.isArray(entry)

/**
 * Normalize a keyframe array. `[]` -> null (ignored). `[a]` -> from current to a.
 * `[a, b, ...]` -> teleport to a (null a = from current), then chain b, ... . A
 * `null` past index 0 HOLDS the previous value (a dwell); a leading run of nulls
 * with no prior value is dropped. Bare values and `{ value, at, ease }` stops mix
 * freely; the per-waypoint `at`/`ease` are collected into parallel arrays.
 */
export function normalizeKeyframes<V>(frames: ReadonlyArray<KeyframeInput<V>>): NormalizedKeyframes<V> | null {
  if (frames.length === 0) return null

  // Flatten each entry to (value|null, at?, ease?), resolving a mid-chain null to
  // a hold of the last concrete value.
  const values: (V | null)[] = []
  const offsets: (number | undefined)[] = []
  const eases: (EasingInput | undefined)[] = []
  let lastConcrete: V | undefined
  for (const entry of frames) {
    const stop = isStop(entry) ? entry : { value: entry as V | null }
    let value = stop.value
    if (value === null && values.length > 0) {
      // A hold: repeat the previous concrete value. With nothing concrete yet, drop it.
      if (lastConcrete === undefined) continue
      value = lastConcrete
    }
    if (value !== null) lastConcrete = value
    values.push(value)
    offsets.push(stop.at)
    eases.push(stop.ease)
  }
  if (values.length === 0) return null

  const head = values[0] ?? null
  const tailValues: V[] = []
  const tailOffsets: (number | undefined)[] = []
  const tailEases: (EasingInput | undefined)[] = []
  for (let i = 1; i < values.length; i++) {
    const value = values[i]
    if (value === null || value === undefined) continue // an unresolved head-hold; skip
    tailValues.push(value)
    tailOffsets.push(offsets[i])
    tailEases.push(eases[i])
  }

  if (tailValues.length === 0) {
    // Single meaningful value: animate from the current state to it.
    if (head === null) return null
    return { teleport: undefined, waypoints: [head], offsets: [offsets[0]], eases: [eases[0]] }
  }
  return { teleport: head === null ? undefined : head, waypoints: tailValues, offsets: tailOffsets, eases: tailEases }
}

export function runKeyframeChain<T>(
  normalized: { teleport: T | undefined; waypoints: T[] },
  ops: ChainOps<T>,
  config: ChainConfig,
): KeyframeChain {
  const { waypoints } = normalized
  let cancelled = false
  let current: AnimationHandle | null = null
  let onInterrupt: ((h: AnimationHandle) => void) | null = null
  let resolveFinished = (): void => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })

  if (waypoints.length === 0) {
    resolveFinished()
    return { handle: { finished, stop: () => {} }, interrupt: () => {} }
  }

  if (config.reduced) {
    // Springs converge, so fast-forwarding every segment equals settling on the
    // last target: collapse straight to the final waypoint.
    ops.settle(waypoints[waypoints.length - 1]!)
    resolveFinished()
    return { handle: { finished, stop: () => {} }, interrupt: () => {} }
  }

  if (normalized.teleport !== undefined) ops.teleport(normalized.teleport)

  const evenMs = config.duration !== undefined ? config.duration / waypoints.length : 0

  void (async () => {
    for (let i = 0; i < waypoints.length; i++) {
      if (cancelled) return
      const waypoint = waypoints[i]!
      if (config.duration !== undefined) {
        const ms = config.segmentDurations?.[i] ?? evenMs
        const easing = config.segmentEasings?.[i] ?? config.easing
        current = ops.tween(waypoint, ms, easing)
      } else {
        current = ops.spring(waypoint)
      }
      await current.finished
      if (cancelled) return
    }
    resolveFinished()
  })()

  // stop() and interrupt() both end the chain mid-flight (a freeze vs. a handoff),
  // so both fire 'interrupt' - the lifecycle owner above hooks it to report
  // onInterrupt instead of onComplete. Natural completion never sets `cancelled`,
  // so it never fires interrupt.
  const handle: AnimationHandle = {
    finished,
    stop: () => {
      if (cancelled) return
      cancelled = true
      current?.stop()
      resolveFinished()
      onInterrupt?.(handle)
    },
    eventCallback(event, fn) {
      if (event === 'interrupt') onInterrupt = fn ?? null
      return handle
    },
  }
  return {
    handle,
    interrupt: () => {
      if (cancelled) return
      cancelled = true
      resolveFinished()
      onInterrupt?.(handle)
    },
  }
}

/**
 * Fill per-waypoint arrival positions to a non-decreasing 0..1 array. Explicit
 * `at` values anchor; gaps interpolate linearly between the nearest anchors (a
 * virtual 0 before the first, 1 at the last when unset) - the times[] contract.
 */
export function fillOffsets(count: number, explicit: ReadonlyArray<number | undefined>): number[] {
  const out: (number | undefined)[] = []
  for (let i = 0; i < count; i++) {
    const at = explicit[i]
    out.push(at === undefined ? undefined : Math.min(1, Math.max(0, at)))
  }
  if (out[count - 1] === undefined) out[count - 1] = 1

  let lastIdx = -1
  let lastVal = 0
  for (let i = 0; i < count; i++) {
    const at = out[i]
    if (at === undefined) continue
    const span = i - lastIdx
    for (let j = lastIdx + 1; j < i; j++) out[j] = lastVal + ((at - lastVal) * (j - lastIdx)) / span
    lastIdx = i
    lastVal = at
  }

  // Clamp to non-decreasing so a mis-ordered `at` can never make a negative segment.
  let prev = 0
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const at = Math.min(1, Math.max(prev, out[i] ?? prev))
    result.push(at)
    prev = at
  }
  return result
}
