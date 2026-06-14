import { follow, type Follow } from '@underlying/core/playback'
import type { SpringOptions } from '@underlying/core'
import type { ScrollControllerInternal } from './controller'
import { clamp01 } from './range'
import type { Disposable } from './types'

export interface SnapOptions {
  /** Snap stops in progress space: a step (0.25), explicit points, or a custom resolver. */
  to: number | readonly number[] | ((p: number, direction: 1 | -1) => number)
  /** Only move in the scroll direction. Default true. */
  directional?: boolean
  spring?: SpringOptions
  onSnap?(progress: number): void
}

// Frames of stillness before we consider the scroll idle and snap.
const IDLE_FRAMES = 2

/**
 * Velocity-aware momentum snap (opt-in; mutually exclusive with CSS
 * scroll-snap). On scroll-idle it picks the nearest stop in progress space,
 * biased by the scroll direction, then springs the scroller there via
 * scrollTo. Under reduced motion the spring is skipped for an instant jump.
 */
export function createSnap(controller: ScrollControllerInternal, options: SnapOptions): Disposable {
  const source = controller.source
  const scheduler = controller.scheduler
  const policy = controller.policy
  const directional = options.directional ?? true
  const resolve = makeResolver(options.to, directional)

  let lastPos = source.scrollPos()
  let direction: 1 | -1 = 1
  let idleFrames = 0
  let snapping = false
  let targetPx = 0
  let snapFrames = 0
  let lastChangeFrame = 0
  let f: Follow | null = null
  let offValue: (() => void) | null = null
  let unsubscribeLoop: (() => void) | null = null

  const sleep = (): void => {
    unsubscribeLoop?.()
    unsubscribeLoop = null
    idleFrames = 0
  }
  const wake = (): void => {
    if (unsubscribeLoop === null) unsubscribeLoop = scheduler.subscribe(onFrame)
  }

  const teardownFollow = (): void => {
    offValue?.()
    offValue = null
    f?.dispose()
    f = null
  }

  const finishSnap = (): void => {
    teardownFollow()
    snapping = false
    lastPos = source.scrollPos()
    const max = source.maxScroll()
    options.onSnap?.(max > 0 ? source.scrollPos() / max : 0)
    sleep()
  }

  const startSnap = (): void => {
    const max = source.maxScroll()
    if (max <= 0) {
      sleep()
      return
    }
    const p = source.scrollPos() / max
    const target = clamp01(resolve(p, direction))
    targetPx = Math.min(Math.max(target * max, 0), max) // never aim past the reachable range
    if (Math.abs(targetPx - source.scrollPos()) < 0.5) {
      sleep() // already on a stop
      return
    }
    if (policy.reduced()) {
      snapping = true // suppress our own scrollTo from re-waking
      source.scrollTo(targetPx)
      snapping = false
      lastPos = source.scrollPos()
      options.onSnap?.(target)
      sleep()
      return
    }
    snapping = true
    snapFrames = 0
    lastChangeFrame = 0
    const follower = follow(source.scrollPos(), { scheduler, ...options.spring })
    offValue = follower.value.on('change', (v) => {
      source.scrollTo(v)
      lastChangeFrame = snapFrames // the spring is still driving
    })
    f = follower
    follower.target(targetPx)
  }

  function onFrame(): void {
    if (snapping) {
      // Finish on ANY of: reached the target, the spring stopped driving (it has
      // rested - so even a clamped/rounded scroller that never hits the exact
      // target still completes), or a hard frame cap. Those last two guarantee
      // `snapping` can never get stuck true and block every future snap.
      snapFrames += 1
      const reached = Math.abs(source.scrollPos() - targetPx) < 0.5
      const rested = snapFrames > 4 && snapFrames - lastChangeFrame >= 3
      if (reached || rested || snapFrames > 150) finishSnap()
      return
    }
    const pos = source.scrollPos()
    if (pos !== lastPos) {
      direction = pos > lastPos ? 1 : -1
      lastPos = pos
      idleFrames = 0
      return
    }
    idleFrames += 1
    if (idleFrames >= IDLE_FRAMES) startSnap()
  }

  const offScroll = source.onScroll(() => {
    if (snapping) return // ignore the scrollTo writes our own follow makes
    wake()
  })

  return {
    dispose() {
      offScroll()
      teardownFollow()
      sleep()
    },
  }
}

function makeResolver(
  to: SnapOptions['to'],
  directional: boolean,
): (p: number, direction: 1 | -1) => number {
  if (typeof to === 'function') return (p, direction) => to(p, direction)
  if (typeof to === 'number') {
    const step = to
    return (p, direction) => {
      const lower = Math.floor(p / step) * step
      const upper = Math.ceil(p / step) * step
      return pick(p, lower, upper, direction, directional)
    }
  }
  const stops = [...to].sort((a, b) => a - b)
  return (p, direction) => {
    let lower = stops[0] ?? 0
    let upper = stops[stops.length - 1] ?? 0
    for (const s of stops) {
      if (s <= p) lower = s
      if (s >= p) {
        upper = s
        break
      }
    }
    return pick(p, lower, upper, direction, directional)
  }
}

// Choose between the two bracketing stops: directional follows the travel
// direction, otherwise the nearer one wins.
function pick(p: number, lower: number, upper: number, direction: 1 | -1, directional: boolean): number {
  if (directional) return direction > 0 ? upper : lower
  return p - lower <= upper - p ? lower : upper
}
