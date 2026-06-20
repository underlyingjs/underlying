import {
  getSharedScheduler,
  onReducedMotionChange,
  prefersReducedMotion,
  type Animatable,
  type Scheduler,
  type SpringOptions,
} from '@underlying/core'
import { follow, type Follow } from '@underlying/core/playback'
import type { Disposable } from './types'

export interface MarqueeOptions {
  /** Base drift, px/s. Default 40. */
  speed?: number
  /** 1 = toward the start (text scrolls left / up); -1 = the other way. Default 1. */
  direction?: 1 | -1
  axis?: 'x' | 'y'
  /**
   * A signed px/s value (e.g. `scroll.velocity()`) added to the drift, so the marquee
   * speeds up and reverses with the scroll. Read live each frame.
   */
  velocity?: Animatable
  /** Scale of the velocity contribution. Default 1. */
  velocityFactor?: number
  /** Ease the drift to a stop while the pointer is over or focus is inside the track, and back on leave. Default false. */
  pauseOnHover?: boolean
  /** The pause spring. */
  spring?: SpringOptions
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

export interface Marquee extends Disposable {
  /** Re-measure the loop. The ResizeObserver does this for size changes; call it after a structural content change. */
  refresh(): void
}

const DEFAULT_SPEED = 40
const MAX_DT_S = 0.05
const CLONE_CAP = 60
const CLONE_FLAG = 'data-marquee-clone'

/**
 * A seamless looping marquee. The track's children are cloned enough to fill the
 * container and the strip drifts at a constant speed, wrapping at exactly one content
 * period so there is no visible seam. Optionally couple it to `scroll.velocity()` so it
 * speeds up and reverses with the scroll. Off under reduced motion, paused on hover or
 * focus (opt-in), asleep while off-screen or the tab is hidden. The container needs
 * `overflow: hidden`. Clones are marked hidden; `dispose()` removes them.
 */
export function marquee(track: HTMLElement, options: MarqueeOptions = {}): Marquee {
  const vertical = (options.axis ?? 'x') === 'y'
  const baseSpeed = (options.speed ?? DEFAULT_SPEED) * (options.direction ?? 1)
  const velocity = options.velocity
  const velocityFactor = options.velocityFactor ?? 1
  const scheduler = options.scheduler ?? getSharedScheduler()

  const pos = (el: HTMLElement): number => (vertical ? el.offsetTop : el.offsetLeft)
  const size = (el: HTMLElement): number => (vertical ? el.offsetHeight : el.offsetWidth)
  const trackExtent = (): number => (vertical ? track.scrollHeight : track.scrollWidth)
  const containerExtent = (): number => {
    const c = track.parentElement
    return c === null ? 0 : vertical ? c.clientHeight : c.clientWidth
  }

  const originals = Array.from(track.children) as HTMLElement[]
  const firstOriginal = originals[0]
  const lastOriginal = originals[originals.length - 1]
  let period = 0
  let offset = 0
  let lastRaw = -1
  let lastNeed = -1

  const render = (): void => {
    const t = -offset
    track.style.transform = vertical ? `translate3d(0,${t}px,0)` : `translate3d(${t}px,0,0)`
  }

  const layout = (): void => {
    if (disposed || firstOriginal === undefined || lastOriginal === undefined) return
    // Measure the originals' own extent first; skip the rebuild if neither they nor the
    // container changed (so a ResizeObserver echo of our own clone churn does not loop).
    const need = containerExtent()
    const raw = pos(lastOriginal) + size(lastOriginal) - pos(firstOriginal)
    if (raw === lastRaw && need === lastNeed && period > 0) return
    lastRaw = raw
    lastNeed = need

    for (const child of Array.from(track.children)) {
      if (child.hasAttribute(CLONE_FLAG)) child.remove()
    }
    let firstClone: HTMLElement | null = null
    const cloneSet = (): void => {
      for (const el of originals) {
        const clone = el.cloneNode(true) as HTMLElement
        clone.setAttribute('aria-hidden', 'true')
        clone.setAttribute('inert', '') // attribute form: works where the IDL prop is unsupported
        clone.inert = true
        clone.setAttribute(CLONE_FLAG, '')
        if (firstClone === null) firstClone = clone
        track.appendChild(clone)
      }
    }
    cloneSet() // one set so the period (which includes the inter-set gap) can be measured
    period = firstClone ? pos(firstClone) - pos(firstOriginal) : 0
    let guard = 0
    while (period > 0 && trackExtent() < need + period && guard < CLONE_CAP) {
      cloneSet()
      guard++
    }
    if (guard >= CLONE_CAP && trackExtent() < need + period) {
      console.warn('[underlying] marquee: content too small to fill the container within the clone cap; a seam may show')
    }
    offset = period > 0 ? ((offset % period) + period) % period : 0
    render()
  }

  // pause-on-hover/focus: a 1 -> 0 multiplier the drift is scaled by, springing both ways.
  let pauseFollow: Follow | null = null
  if (options.pauseOnHover) {
    const springConfig = { stiffness: 220, ...(options.spring ?? {}) }
    pauseFollow = follow(1, options.scheduler ? { ...springConfig, scheduler } : springConfig)
  }
  const onEnter = (): void => pauseFollow?.target(0)
  const onLeave = (): void => pauseFollow?.target(1)

  const onFrame = (frame: { deltaMs: number }): void => {
    if (period <= 0) return
    const dt = Math.min(frame.deltaMs, MAX_DT_S * 1000) / 1000
    const gate = pauseFollow ? pauseFollow.value.get() : 1
    const v = (baseSpeed + (velocity ? velocity.get() * velocityFactor : 0)) * gate
    offset = ((offset + v * dt) % period + period) % period
    render()
  }

  let disposed = false
  let unsubscribe: (() => void) | null = null
  let visible = true
  let reduced = prefersReducedMotion()
  let pageHidden = typeof document !== 'undefined' && document.hidden
  const sync = (): void => {
    if (disposed) return
    const run = !reduced && visible && !pageHidden
    if (run && unsubscribe === null) {
      unsubscribe = scheduler.subscribe(onFrame)
      track.style.willChange = 'transform'
    } else if (!run && unsubscribe !== null) {
      unsubscribe()
      unsubscribe = null
      track.style.willChange = '' // release the compositor layer while idle
    }
  }

  layout()

  if (options.pauseOnHover) {
    track.addEventListener('pointerenter', onEnter)
    track.addEventListener('pointerleave', onLeave)
    track.addEventListener('focusin', onEnter) // keyboard users can pause too (WCAG 2.2.2)
    track.addEventListener('focusout', onLeave)
  }

  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null
  // Watch the TRACK (child / font / image growth changes the period) and the container (resize changes the fill count).
  resizeObserver?.observe(track)
  if (track.parentElement) resizeObserver?.observe(track.parentElement)

  const intersectionObserver =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          visible = entries[entries.length - 1]?.isIntersecting ?? true
          sync()
        })
      : null
  intersectionObserver?.observe(track.parentElement ?? track)

  const onVisibility = (): void => {
    pageHidden = document.hidden
    sync()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)

  const offPolicy = onReducedMotionChange((isReduced) => {
    reduced = isReduced
    if (reduced) {
      offset = 0
      render() // sit still at the start
    }
    sync()
  })

  sync()

  return {
    refresh() {
      if (!disposed) layout()
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribe?.()
      offPolicy()
      resizeObserver?.disconnect()
      intersectionObserver?.disconnect()
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
      pauseFollow?.dispose()
      if (options.pauseOnHover) {
        track.removeEventListener('pointerenter', onEnter)
        track.removeEventListener('pointerleave', onLeave)
        track.removeEventListener('focusin', onEnter)
        track.removeEventListener('focusout', onLeave)
      }
      for (const child of Array.from(track.children)) {
        if (child.hasAttribute(CLONE_FLAG)) child.remove()
      }
      track.style.transform = ''
      track.style.willChange = ''
    },
  }
}
