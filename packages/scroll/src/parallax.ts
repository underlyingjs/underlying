import { animatable, type Animatable } from '@underlying/core'
import { follow, type Follow } from '@underlying/core/playback'
import type { SpringOptions } from '@underlying/core'
import type { ScrollControllerInternal } from './controller'
import type { ScrollRange } from './range'
import { stiffnessFor } from './smooth'
import type { Disposable } from './types'

export interface ParallaxOptions {
  target?: HTMLElement
  range?: ScrollRange
  /** Output px at p=0 and p=1, e.g. [-120, 120]. */
  output: readonly [number, number]
  /** Momentum smoothing seconds. 0 (default) = locked, follows scroll exactly. */
  smooth?: number
  spring?: SpringOptions
}

/** An Animatable (hand to bindStyle) plus its own disposer. */
export type ParallaxValue = Animatable & Disposable

/**
 * Map a range's progress to px on an Animatable. Locked drives the value
 * directly each frame; momentum routes it through a follow(). The returned
 * value goes straight into bindStyle, so a parallax layer and a follow-driven
 * layer serialize through the same transform formatter.
 */
export function createParallax(
  controller: ScrollControllerInternal,
  options: ParallaxOptions,
): ParallaxValue {
  const track = controller.track({
    ...(options.target !== undefined ? { target: options.target } : {}),
    ...(options.range !== undefined ? { range: options.range } : {}),
  })

  const [from, to] = options.output
  const at = (p: number): number => from + (to - from) * p
  const smooth = options.smooth ?? 0
  const momentum = smooth > 0
  const policy = controller.policy
  const scheduler = controller.scheduler

  // The single returned value. drive() dedupes on position, so re-driving an
  // unchanged p is a no-op; a resize landing on a NEW p re-writes via track.on.
  const out = animatable(at(track.progress()), { scheduler })

  // Momentum bridges a follow() onto `out` so the reduced-motion switch (and
  // dispose) stay uniform whatever the mode.
  let f: Follow | null = null
  let offFollow: (() => void) | null = null
  const startMomentum = (): void => {
    const follower = follow(at(track.progress()), {
      scheduler,
      stiffness: stiffnessFor(smooth),
      ...options.spring,
    })
    offFollow = follower.value.on('change', (v) => {
      out.drive({ position: v, velocity: follower.value.velocity() })
    })
    f = follower
    follower.target(at(track.progress()))
  }
  const stopMomentum = (): void => {
    offFollow?.()
    offFollow = null
    f?.dispose()
    f = null
  }

  let reduced = policy.reduced()
  const offTrack = track.on((p) => {
    if (reduced) return // disabled: held at the CSS resting transform
    if (momentum) f?.target(at(p))
    else out.drive({ position: at(p), velocity: 0 })
  })

  const enterReduced = (): void => {
    stopMomentum()
    out.drive({ position: 0, velocity: 0 }) // no parallax offset = CSS rest
  }
  const enterFull = (): void => {
    if (momentum) startMomentum()
    else out.drive({ position: at(track.progress()), velocity: 0 })
  }

  if (reduced) enterReduced()
  else enterFull()

  const offPolicy = policy.onChange((next) => {
    if (next === reduced) return
    reduced = next
    if (reduced) enterReduced()
    else enterFull()
  })

  return asParallaxValue(out, () => {
    offTrack()
    offPolicy()
    stopMomentum()
    out.dispose()
    track.dispose()
  })
}

// Delegate the Animatable surface to `out`, swapping in our own dispose. The
// animatable methods are this-free closures, so copying the references is safe.
function asParallaxValue(out: Animatable, dispose: () => void): ParallaxValue {
  return {
    get: out.get,
    velocity: out.velocity,
    isAnimating: out.isAnimating,
    set: out.set,
    drive: out.drive,
    stop: out.stop,
    spring: out.spring,
    decay: out.decay,
    to: out.to,
    simulate: out.simulate,
    on: out.on,
    dispose,
  }
}
