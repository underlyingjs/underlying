import { follow } from '@underlying/core/playback'
import type { SpringOptions } from '@underlying/core'
import type { Follow, PlaybackHandle } from '@underlying/core/playback'
import type { ScrollControllerInternal } from './controller'
import type { ScrollRange } from './range'
import { stiffnessFor } from './smooth'
import type { Track } from './track'
import type { Disposable } from './types'

/** What scroll drives: a seekable handle (locked), or a raw progress callback (always locked). */
export type ScrubTarget = PlaybackHandle | ((p: number) => void)

export interface ScrubOptions {
  /** Element + range. Mutually exclusive with `track`. */
  target?: HTMLElement
  range?: ScrollRange
  /** Pre-built Track (e.g. pin.track) to scrub off. Overrides target/range; borrowed, not owned. */
  track?: Track
  /**
   * false (default) = LOCKED: handle.progress(p) each frame. Deterministic, reversible, a11y-safe.
   * number          = MOMENTUM: catch-up seconds. Maps to follow() stiffness (lower = longer catch-up).
   *                   Ignored for a raw callback (callbacks are always locked).
   */
  smooth?: false | number
  /** Spring overrides for momentum; merged over the catch-up default. */
  spring?: SpringOptions
}

/**
 * Wire a Track onto a handle (or callback). Locked drives handle.progress(p)
 * frame-exact; momentum routes the progress through a follow() so the handle
 * lags the scroll by `smooth` seconds, velocity conserved. The physics live in
 * core; this is glue.
 */
export function createScrub(
  controller: ScrollControllerInternal,
  target: ScrubTarget,
  options: ScrubOptions = {},
): Disposable {
  // A borrowed track (pin.track) is never disposed by us; an owned one is.
  const ownsTrack = options.track === undefined
  const track =
    options.track ??
    controller.track({
      ...(options.target !== undefined ? { target: options.target } : {}),
      ...(options.range !== undefined ? { range: options.range } : {}),
    })

  const disposeTrack = (): void => {
    if (ownsTrack) track.dispose()
  }

  // A raw callback has nothing to seek, so momentum is meaningless: always locked.
  if (typeof target === 'function') {
    const off = track.on(target)
    target(track.progress()) // initial paint without waiting a frame
    return {
      dispose() {
        off()
        disposeTrack()
      },
    }
  }

  const handle = target
  ensureSeekable(handle)

  const smooth = options.smooth
  const momentum = typeof smooth === 'number' && smooth > 0

  if (!momentum) {
    // LOCKED: frame-exact, reversible, a11y-safe.
    const off = track.on((p) => {
      handle.progress(p)
    })
    handle.progress(track.progress())
    return {
      dispose() {
        off()
        disposeTrack()
      },
    }
  }

  // MOMENTUM: route progress through a fresh follow() per binding so the handle
  // lags the scroll by `smooth` seconds, velocity conserved. Under reduced
  // motion it collapses to locked (no overshoot) and re-routes live on toggle.
  // span just scales the follow; it cancels on the way back out, so the
  // stiffness feel is span-independent.
  const span = handle.duration() ?? 1
  const policy = controller.policy
  let f: Follow | null = null
  let offValue: (() => void) | null = null

  const startFollow = (): void => {
    const follower = follow(track.progress() * span, {
      scheduler: controller.scheduler,
      stiffness: stiffnessFor(smooth),
      ...options.spring,
    })
    offValue = follower.value.on('change', (v) => {
      handle.progress(v / span)
    })
    f = follower
    follower.target(track.progress() * span)
  }
  const stopFollow = (): void => {
    offValue?.()
    offValue = null
    f?.dispose()
    f = null
  }

  let reduced = policy.reduced()
  const offTrack = track.on((p) => {
    if (reduced) handle.progress(p)
    else f?.target(p * span)
  })

  if (reduced) handle.progress(track.progress())
  else startFollow()

  const offPolicy = policy.onChange((next) => {
    if (next === reduced) return
    reduced = next
    if (reduced) {
      stopFollow()
      handle.progress(track.progress()) // snap to the live position, no momentum
    } else {
      startFollow()
    }
  })

  return {
    dispose() {
      offTrack()
      offPolicy()
      stopFollow()
      disposeTrack()
    },
  }
}

function ensureSeekable(handle: PlaybackHandle): void {
  if (handle.seekable) return
  if (handle.kind === 'physics') {
    // A spring is seekable only after a successful bake(). Do it once, here,
    // not every frame: a clear error beats a silent per-frame warn+no-op.
    if (handle.bake()) return
    throw new Error(
      '@underlying/scroll: scrub() needs a seekable handle, and bake() failed because the spring never rests. Pass a tween (.to) or a bounded spring.',
    )
  }
  throw new Error('@underlying/scroll: scrub() needs a seekable handle.')
}
