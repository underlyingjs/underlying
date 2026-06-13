import type { Easing } from '../physics/easings'
import type { AnimationHandle } from '../value/animatable'

/**
 * Keyframe semantics, shared by numeric channels and registry property groups.
 * Without a duration the waypoints are CHAINED SPRINGS: spring to waypoint k,
 * and only once it has rested (exact snap) spring to k+1 - the honest physics
 * of "spring through a list of targets". With a duration they become a
 * piecewise tween, the duration split evenly with the easing applied per
 * segment. A new animate() interrupts the chain (velocity conserved into the
 * replacement); stop() freezes the running segment and drops the rest. Never
 * rejects.
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
  /** A null appeared past index 0 and was dropped (null only means "from current" at index 0). */
  droppedNull: boolean
}

/**
 * Normalize a keyframe array. `[]` -> null (ignored). `[a]` -> from current to a.
 * `[a, b, ...]` -> teleport to a (null a = from current), then chain b, ... . A null
 * anywhere but index 0 is invalid and dropped.
 */
export function normalizeKeyframes<V>(frames: ReadonlyArray<V | null>): NormalizedKeyframes<V> | null {
  if (frames.length === 0) return null
  const head = frames[0] ?? null
  const tail: V[] = []
  let droppedNull = false
  for (let i = 1; i < frames.length; i++) {
    const value = frames[i]
    if (value === null || value === undefined) droppedNull = true
    else tail.push(value)
  }
  if (tail.length === 0) {
    // Single meaningful value: animate from the current state to it.
    return head === null ? null : { teleport: undefined, waypoints: [head], droppedNull }
  }
  return { teleport: head === null ? undefined : head, waypoints: tail, droppedNull }
}

export function runKeyframeChain<T>(
  normalized: { teleport: T | undefined; waypoints: T[] },
  ops: ChainOps<T>,
  config: ChainConfig,
): KeyframeChain {
  const { waypoints } = normalized
  let cancelled = false
  let current: AnimationHandle | null = null
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

  const segmentMs = config.duration !== undefined ? config.duration / waypoints.length : 0

  void (async () => {
    for (const waypoint of waypoints) {
      if (cancelled) return
      current =
        config.duration !== undefined
          ? ops.tween(waypoint, segmentMs, config.easing)
          : ops.spring(waypoint)
      await current.finished
      if (cancelled) return
    }
    resolveFinished()
  })()

  return {
    handle: {
      finished,
      stop: () => {
        if (cancelled) return
        cancelled = true
        current?.stop()
        resolveFinished()
      },
    },
    interrupt: () => {
      if (cancelled) return
      cancelled = true
      resolveFinished()
    },
  }
}
