import {
  animate as animateImpl,
  releaseStyle,
  setStyle as setStyleImpl,
  type AnimateOptions,
  type AnimateTargets,
  type AnimationTarget,
} from '../dom/animate'
import { resolveTargets, type AnimatableElement } from '../dom/resolve-target'
import type { AnimationHandle } from '../value/animatable'
import { stagger as staggerImpl, type StaggerOptions } from './composition'
import { responsive as responsiveImpl, type ResponsiveSetup } from './responsive'
import type { DelayFn } from './stagger-delay'

/**
 * A teardown boundary: everything created through it is collected, and a single
 * `revert()` undoes it all - stops the animations, removes the media listeners,
 * runs the registered disposers (LIFO), and releases the inline styles back to
 * computed. Named `region` (not `scope`) to avoid the `AnimateOptions.scope`
 * callback-receiver field. This is the mount/unmount seam a framework adapter
 * sits on. Collection is EXPLICIT (call the region's methods) - never ambient,
 * so it cannot silently miss or capture an unrelated animation.
 */
export interface Region {
  /** Scope-bound animate(): auto-stopped and its elements released on revert. */
  animate(target: AnimationTarget, targets: AnimateTargets, options?: AnimateOptions): AnimationHandle
  /** Scope-bound stagger(): the aggregate is auto-stopped on revert. */
  /**
   * Scope-bound stagger(): the aggregate is auto-stopped on revert. Note: styles
   * set INSIDE the item animations are NOT released (the items are opaque) - use
   * region.animate() per item if you need the styles reverted to computed.
   */
  stagger<T>(
    items: readonly T[],
    animation: (item: T, index: number) => AnimationHandle,
    delay?: number | DelayFn,
    options?: StaggerOptions,
  ): AnimationHandle
  /** Scope-bound responsive(): its unsubscribe is auto-run on revert. */
  responsive(query: string | { reducedMotion: boolean }, setup: ResponsiveSetup): () => void
  /** Scope-bound setStyle(): the touched element is released on revert. */
  setStyle(...args: Parameters<typeof setStyleImpl>): void
  /** Register any disposer (a gesture/interactive handle's dispose, a raw cleanup). Returns it unchanged. */
  add<T extends () => void>(cleanup: T): T
  /** Register an externally created handle so its stop() runs on revert. Returns it unchanged. */
  track(handle: AnimationHandle): AnimationHandle
  /** Tear everything down, LIFO, then release touched styles. Idempotent. */
  revert(): void
}

/**
 * Create a teardown boundary. Pass a `setup` to wire everything up inline; the
 * region is returned either way. `revert()` is the single undo.
 */
// One throwing disposer must not abort the rest of the teardown - report and continue.
const safely = (fn: () => void): void => {
  try {
    fn()
  } catch (error) {
    console.error('[underlying] region teardown threw', error)
  }
}

export function region(setup?: (region: Region) => void): Region {
  const disposers: Array<() => void> = []
  const touched = new Set<AnimatableElement>()
  let reverted = false

  const instance: Region = {
    animate(target, targets, options) {
      // Resolve once: add the resolved elements to `touched` AND hand the concrete
      // list to animate() (an element array re-resolves without a second query).
      const elements = resolveTargets(target)
      for (const element of elements) touched.add(element)
      const handle = animateImpl(elements, targets, options)
      disposers.push(() => handle.stop())
      return handle
    },
    stagger(items, animation, delay, options) {
      const handle = staggerImpl(items, animation, delay, options)
      disposers.push(() => handle.stop())
      return handle
    },
    responsive(query, responsiveSetup) {
      const off = responsiveImpl(query, responsiveSetup)
      disposers.push(off)
      return off
    },
    setStyle(...args) {
      touched.add(args[0])
      setStyleImpl(...args)
    },
    add(cleanup) {
      disposers.push(cleanup)
      return cleanup
    },
    track(handle) {
      disposers.push(() => handle.stop())
      return handle
    },
    revert() {
      if (reverted) return
      reverted = true
      for (let i = disposers.length - 1; i >= 0; i--) safely(disposers[i]!)
      disposers.length = 0
      for (const element of touched) safely(() => releaseStyle(element))
      touched.clear()
    },
  }

  if (setup !== undefined) setup(instance)
  return instance
}
