import { follow, type Follow } from '@underlying/core/playback'
import type { SpringOptions } from '@underlying/core'
import type { ScrollControllerInternal } from './controller'
import { type OffsetEntry, resolveOffset } from './range'

export interface ScrollToOptions {
  /**
   * For an element target: which `'<elementEdge> <viewportEdge>'` pair to bring
   * into alignment. Default `'start start'` - the element's leading edge meets
   * the viewport's leading edge (the section's top lands at the top).
   */
  align?: OffsetEntry
  /** Pixel nudge applied after alignment - e.g. `-80` to clear a sticky header. */
  offset?: number
  /**
   * The spring that drives the scroll. Default: a critically-damped follow (no
   * overshoot). Applied to a fresh scroll; a re-aim mid-flight keeps the spring
   * already in motion (see `scrollTo`).
   */
  spring?: SpringOptions
  /** Jump with no animation. Always on under reduced motion. */
  immediate?: boolean
  /** Fires once the scroller settles at the target, or when the scroll is superseded/canceled. */
  onArrive?(): void
}

export interface ScrollToHandle {
  /** Resolves when the scroller settles, or when this scroll is canceled/superseded. Never rejects. */
  readonly finished: Promise<void>
  /** Stop the scroller where it currently is and resolve `finished`. */
  cancel(): void
}

export interface ScrollToDriver {
  /** Spring (or jump) the scroller to a target. */
  to(target: number | HTMLElement, options?: ScrollToOptions): ScrollToHandle
  /** Stop any in-flight scroll and release the spring. */
  dispose(): void
}

interface ActiveScroll {
  targetPx: number
  readonly onArrive: (() => void) | undefined
  readonly resolve: () => void
  frames: number
  lastDriveFrame: number
  settled: boolean
}

/**
 * The controller's single programmatic-scroll driver. One `follow()` is shared
 * across calls so a `scrollTo` issued mid-flight RE-AIMS the spring already in
 * motion - velocity conserved, no restart jolt - which is the physics-first win
 * over a tween that would snap to a new from/to. A scroll started from rest
 * builds a fresh spring at the current position (velocity 0). The follow drives
 * its value via `drive()`, which never emits `rest`, so - exactly like `snap()`
 * - arrival is detected on a frame loop: reached the target, the spring stopped
 * driving (a clamped or pixel-rounded scroller that never lands exactly still
 * completes), or a hard cap so a handle can never hang.
 */
export function createScrollDriver(controller: ScrollControllerInternal): ScrollToDriver {
  let follower: Follow | null = null
  let offChange: (() => void) | null = null
  let unsubscribeLoop: (() => void) | null = null
  let active: ActiveScroll | null = null

  const stopLoop = (): void => {
    unsubscribeLoop?.()
    unsubscribeLoop = null
  }

  const releaseFollow = (): void => {
    offChange?.()
    offChange = null
    follower?.dispose()
    follower = null
  }

  // Resolve a handle. When it is the live one, drop the loop too; release the
  // spring only when nothing succeeds it (`keepFollow` is set during a re-aim).
  const resolve = (scroll: ActiveScroll, keepFollow: boolean): void => {
    if (scroll.settled) return
    scroll.settled = true
    if (active === scroll) {
      active = null
      stopLoop()
      if (!keepFollow) releaseFollow()
    }
    scroll.onArrive?.()
    scroll.resolve()
  }

  const onLoopFrame = (): void => {
    const scroll = active
    if (scroll === null) {
      stopLoop()
      return
    }
    const engine = controller.smoothEngine
    // smooth() was enabled mid-flight while we own a follow: hand the target to the
    // engine's single spring so the two never co-drive native scroll and stall.
    if (engine && engine.enabled() && follower !== null) {
      releaseFollow()
      engine.setTarget(scroll.targetPx, { conserveVelocity: true })
    }
    scroll.frames += 1
    const reached = Math.abs(controller.source.scrollPos() - scroll.targetPx) < 0.5
    // In engine mode we don't own the spring's change events, so rest is read from
    // the engine's velocity rather than the lastDriveFrame heuristic.
    const rested =
      engine && engine.enabled()
        ? scroll.frames > 4 && Math.abs(engine.velocity()) < 1
        : scroll.frames > 4 && scroll.frames - scroll.lastDriveFrame >= 3
    if (reached || rested || scroll.frames > 600) resolve(scroll, false)
  }

  const ensureFollow = (startPos: number, spring?: SpringOptions): Follow => {
    if (follower === null) {
      follower = follow(startPos, { scheduler: controller.scheduler, ...spring })
      offChange = follower.value.on('change', (v) => {
        controller.source.scrollTo(v)
        if (active) active.lastDriveFrame = active.frames // the spring is still driving
      })
    }
    return follower
  }

  const to = (target: number | HTMLElement, options: ScrollToOptions = {}): ScrollToHandle => {
    const source = controller.source
    const max = source.maxScroll()
    const aligned =
      typeof target === 'number'
        ? target
        : resolveOffset(options.align ?? 'start start', source.measure(target), source.viewportSize())
    const aimed = aligned + (options.offset ?? 0)
    const targetPx = aimed < 0 ? 0 : aimed > max ? max : aimed // never aim past the reachable range

    let settle: () => void = () => {}
    const finished = new Promise<void>((r) => {
      settle = r
    })

    // Instant path: explicit immediate, reduced motion, an unscrollable axis, or
    // already there. Abandon any in-flight spring and write once.
    if (options.immediate || controller.policy.reduced() || max <= 0 || Math.abs(targetPx - source.scrollPos()) < 0.5) {
      if (active) resolve(active, false)
      releaseFollow()
      source.scrollTo(targetPx)
      options.onArrive?.()
      settle()
      return { finished, cancel: () => {} }
    }

    const reAim = active !== null
    if (reAim) {
      resolve(active as ActiveScroll, true) // resolve the superseded handle, keep the spring's momentum
    } else {
      releaseFollow() // drop any idle/rested spring; start clean from the current position
    }

    const scroll: ActiveScroll = {
      targetPx,
      onArrive: options.onArrive,
      resolve: settle,
      frames: 0,
      lastDriveFrame: 0,
      settled: false,
    }
    active = scroll
    if (unsubscribeLoop === null) unsubscribeLoop = controller.scheduler.subscribe(onLoopFrame)

    // When the smooth engine is active, route through its single spring instead of
    // building a second native-scroll writer; keep the same arrival loop + handle.
    const engine = controller.smoothEngine
    if (engine && engine.enabled()) {
      releaseFollow() // never co-drive with the engine
      engine.setTarget(targetPx) // springs from the live position+velocity (re-aim conserves momentum)
      return {
        finished,
        cancel: () => {
          if (scroll.settled) return
          engine.setTarget(source.scrollPos(), { conserveVelocity: false }) // freeze here, kill momentum
          resolve(scroll, false)
        },
      }
    }

    const followInstance = ensureFollow(source.scrollPos(), options.spring)
    followInstance.target(targetPx) // re-aims from the live position+velocity when reAim

    return {
      finished,
      cancel: () => {
        if (scroll.settled) return
        followInstance.stop() // freeze the scroller where it is
        resolve(scroll, false)
      },
    }
  }

  return {
    to,
    dispose() {
      if (active) resolve(active, false)
      releaseFollow()
      stopLoop()
    },
  }
}
