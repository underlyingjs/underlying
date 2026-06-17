import { getSharedScheduler, type Scheduler } from '@underlying/core'
import { createMotionPolicy, type MotionPolicy } from './a11y'
import { createMarkers, type MarkerOptions } from './markers'
import { createParallax, type ParallaxOptions, type ParallaxValue } from './parallax'
import { createPin, type Pin, type PinOptions } from './pin'
import { createScrollDriver, type ScrollToDriver, type ScrollToHandle, type ScrollToOptions } from './scroll-to'
import { createScrub, type ScrubOptions, type ScrubTarget } from './scrub'
import { createSnap, type SnapOptions } from './snap'
import { createDomScrollSource } from './source-dom'
import type { ScrollSource } from './source'
import { createTrack, type Track, type TrackInternal, type TrackOptions } from './track'
import { createTrigger, type TriggerOptions } from './triggers'
import type { Disposable } from './types'

export interface ScrollControllerOptions {
  /** The scrollable container. Default: the viewport (lazy; never read at import). */
  scroller?: HTMLElement
  axis?: 'y' | 'x'
  /** Frame loop. Default getSharedScheduler(). Tests inject createScheduler(createManualDriver()). */
  scheduler?: Scheduler
  /** Test/SSR seam: replaces the DOM source. Default = the lazy browser source. */
  source?: ScrollSource
  /** Reduced-motion policy. Default = core's a11y state. Tests inject a manual one. */
  policy?: MotionPolicy
}

export interface ScrollController {
  /** A standalone Track over a range. Hand it to scrub()/parallax()/snap(), or read it directly. */
  track(options?: TrackOptions): Track
  /** Locked or momentum scrub of a handle (or raw callback). Returns a disposer. */
  scrub(target: ScrubTarget, options?: ScrubOptions): Disposable
  /** Parallax: maps a range's progress to px on a bindStyle-ready Animatable. */
  parallax(options: ParallaxOptions): ParallaxValue
  /** Pin an element across a range. Exposes its own child Track for nested scrubs. */
  pin(element: HTMLElement, options?: PinOptions): Pin
  /** Velocity-aware momentum snap (opt-in; mutually exclusive with CSS scroll-snap). */
  snap(options: SnapOptions): Disposable
  /** Enter/leave triggers (IntersectionObserver), toggleActions-style. */
  trigger(element: HTMLElement, options: TriggerOptions): Disposable
  /**
   * Spring the scroller to a target - an absolute px position or an element
   * brought into view. A scroll issued mid-flight re-aims the spring already in
   * motion (velocity conserved); one from rest starts fresh. Returns a handle
   * with `finished` and `cancel()`.
   */
  scrollTo(target: number | HTMLElement, options?: ScrollToOptions): ScrollToHandle
  /** Dev markers for a range. Dev-only; returns a disposer. */
  markers(options?: MarkerOptions): Disposable
  /** Whole-scroller progress 0..1 (cheap; maxScroll-based). */
  progress(): number
  /** Re-measure every registered track. Call after layout the controller can't observe. */
  refresh(): void
  /** Tear down the loop, listeners and every track made from this controller. */
  dispose(): void
}

/** Internal handle the builders (scrub/pin/parallax/snap/trigger) compose against. */
export interface ScrollControllerInternal extends ScrollController {
  readonly source: ScrollSource
  readonly scheduler: Scheduler
  readonly policy: MotionPolicy
  readonly axis: 'x' | 'y'
  /** The IntersectionObserver/scroll root: a custom scroller, or null for the viewport. */
  readonly root: HTMLElement | null
  /** Register a Track so the single loop samples it; returns the same track. */
  register(track: TrackInternal): TrackInternal
}

export function createScroll(options: ScrollControllerOptions = {}): ScrollControllerInternal {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const policy = options.policy ?? createMotionPolicy()
  const axis = options.axis ?? 'y'
  const root = options.scroller ?? null
  const injected = options.source
  let source: ScrollSource | null = injected ?? null
  let createdSource: ScrollSource | null = null

  const tracks = new Set<TrackInternal>()
  let scrollDriver: ScrollToDriver | null = null
  let dirty = false
  let unsubscribeLoop: (() => void) | null = null
  let unsubscribeScroll: (() => void) | null = null
  let unsubscribeResize: (() => void) | null = null

  const ensureSource = (): ScrollSource => {
    if (source !== null) return source
    createdSource = createDomScrollSource(root ? { scroller: root, axis } : { axis })
    source = createdSource
    return source
  }

  // One update-phase callback. While anything moved, sample every track (each
  // reads the cached scrollPos); when a frame brings nothing new, the loop sleeps
  // (follow()/bindStyle keep their own subscriptions for in-flight momentum).
  const onFrame = (): void => {
    if (!dirty) {
      unsubscribeLoop?.()
      unsubscribeLoop = null
      return
    }
    dirty = false
    for (const track of [...tracks]) track.sample()
  }

  const wake = (): void => {
    dirty = true
    if (unsubscribeLoop === null) unsubscribeLoop = scheduler.subscribe(onFrame)
  }

  const ensureListeners = (): void => {
    const s = ensureSource()
    unsubscribeScroll ??= s.onScroll(wake)
    unsubscribeResize ??= s.onResize(() => {
      for (const track of [...tracks]) track.refresh()
    })
  }

  const register = (track: TrackInternal): TrackInternal => {
    ensureListeners()
    tracks.add(track)
    wake() // sample once so the binding gets its initial value
    return track
  }

  const controller: ScrollControllerInternal = {
    get source() {
      return ensureSource()
    },
    scheduler,
    policy,
    axis,
    root,
    register,
    track(trackOptions = {}) {
      return register(createTrack(ensureSource(), trackOptions))
    },
    scrub(target, scrubOptions) {
      return createScrub(controller, target, scrubOptions)
    },
    parallax(parallaxOptions) {
      return createParallax(controller, parallaxOptions)
    },
    pin(element, pinOptions) {
      return createPin(controller, element, pinOptions)
    },
    snap(snapOptions) {
      return createSnap(controller, snapOptions)
    },
    trigger(element, triggerOptions) {
      return createTrigger(controller, element, triggerOptions)
    },
    scrollTo(target, scrollToOptions) {
      scrollDriver ??= createScrollDriver(controller) // one shared spring: re-aim, never overlap
      return scrollDriver.to(target, scrollToOptions)
    },
    markers(markerOptions) {
      return createMarkers(controller, markerOptions)
    },
    progress() {
      const s = ensureSource()
      const max = s.maxScroll()
      if (max <= 0) return 0
      return Math.min(Math.max(s.scrollPos() / max, 0), 1)
    },
    refresh() {
      for (const track of [...tracks]) track.refresh()
    },
    dispose() {
      scrollDriver?.dispose()
      scrollDriver = null
      unsubscribeLoop?.()
      unsubscribeScroll?.()
      unsubscribeResize?.()
      unsubscribeLoop = unsubscribeScroll = unsubscribeResize = null
      for (const track of [...tracks]) track.dispose()
      tracks.clear()
      createdSource?.dispose() // dispose only a source we created, never an injected one
    },
  }
  return controller
}
