import type { PlaybackHandle } from '@underlying/core/playback'
import type { ScrollControllerInternal } from './controller'
import type { OffsetEntry, ScrollRange } from './range'
import type { Disposable } from './types'

/** A verb applied to the `toggle` handle when a crossing fires (ScrollTrigger toggleActions). */
export type TriggerAction = 'play' | 'pause' | 'resume' | 'reverse' | 'restart' | 'reset' | 'none'

export interface TriggerOptions {
  /**
   * Active band as a viewport inset. Reserved for forward-compat: only a
   * uniform `${n}px` / `${n}%` pair becomes a rootMargin; edge-pair ranges
   * (incl. the default) fire on the element's own viewport intersection.
   */
  range?: ScrollRange
  /** Handle the four crossings drive via `toggleActions`. */
  toggle?: PlaybackHandle
  /** [onEnter, onLeave, onEnterBack, onLeaveBack]. Default ['play','none','none','none']. */
  toggleActions?: readonly [TriggerAction, TriggerAction, TriggerAction, TriggerAction]
  onEnter?(): void
  onLeave?(): void
  onEnterBack?(): void
  onLeaveBack?(): void
}

const DEFAULT_ACTIONS = ['play', 'none', 'none', 'none'] as const

/**
 * Enter/leave triggers via IntersectionObserver (never rect-polling). The four
 * ScrollTrigger directions are read from the entry geometry: `fromBelow` is
 * whether the element's leading edge sits at or past the viewport's leading
 * edge, which separates enter from enter-back and leave from leave-back.
 */
export function createTrigger(
  controller: ScrollControllerInternal,
  element: HTMLElement,
  options: TriggerOptions,
): Disposable {
  const axis = controller.axis
  const actions = options.toggleActions ?? DEFAULT_ACTIONS
  const handle = options.toggle
  let intersecting = false

  const fire = (index: 0 | 1 | 2 | 3, callback: (() => void) | undefined): void => {
    callback?.()
    if (handle) applyAction(handle, actions[index])
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting === intersecting) continue // not a real crossing
        intersecting = entry.isIntersecting
        const below = fromBelow(entry, axis)
        if (intersecting) {
          if (below) fire(0, options.onEnter)
          else fire(2, options.onEnterBack)
        } else if (below) {
          fire(3, options.onLeaveBack)
        } else {
          fire(1, options.onLeave)
        }
      }
    },
    { root: controller.root, threshold: 0, rootMargin: rootMarginFor(options.range) },
  )
  observer.observe(element)

  return {
    dispose() {
      observer.disconnect()
    },
  }
}

// True when the element's leading edge is at or past the viewport's leading
// edge: entering -> came from below (onEnter); leaving -> exited the far edge
// (onLeaveBack). rootBounds is null only in rare cross-origin cases.
function fromBelow(entry: IntersectionObserverEntry, axis: 'x' | 'y'): boolean {
  const rb = entry.rootBounds
  if (rb === null) return true
  const r = entry.boundingClientRect
  return axis === 'y' ? r.top >= rb.top : r.left >= rb.left
}

function applyAction(handle: PlaybackHandle, action: TriggerAction): void {
  switch (action) {
    case 'play':
      handle.play()
      break
    case 'pause':
      handle.pause()
      break
    case 'resume':
      handle.resume()
      break
    case 'reverse':
      handle.reverse()
      break
    case 'restart':
      handle.seek(0).play()
      break
    case 'reset':
      handle.seek(0).pause()
      break
    case 'none':
      break
  }
}

// Only a uniform numeric/px/% range maps cleanly onto IO's rootMargin; element
// -edge offsets need the element size, which IO cannot express. Anything else
// (incl. the default edge-pair range) falls back to the raw intersection.
function rootMarginFor(range: ScrollRange | undefined): string {
  if (range === undefined) return '0px'
  const inset = uniformInset(range[0], range[1])
  return inset ?? '0px'
}

function uniformInset(enter: OffsetEntry, leave: OffsetEntry): string | null {
  if (typeof enter !== 'string' || typeof leave !== 'string') return null
  const px = /^(-?\d+(?:\.\d+)?)px$/
  const pct = /^(-?\d+(?:\.\d+)?)%$/
  if ((px.test(enter) && px.test(leave)) || (pct.test(enter) && pct.test(leave))) {
    return `${enter} ${leave} ${enter} ${leave}`
  }
  return null
}
