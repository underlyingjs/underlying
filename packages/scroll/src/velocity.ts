import { animatable, type Animatable, type SpringOptions } from '@underlying/core'
import { follow, type Follow } from '@underlying/core/playback'
import type { ScrollControllerInternal } from './controller'
import { stiffnessFor } from './smooth'
import type { Disposable } from './types'

export interface VelocityOptions {
  /** Seconds of smoothing on the ramp and on the relax to rest. Default 0.15. */
  smooth?: number
  spring?: SpringOptions
  /**
   * Map the raw signed scroll velocity (px/s; positive in the scroll direction)
   * to the value this carries - e.g. clamp it and scale it to a few degrees of
   * skew, a scale factor, or a blur radius. Default: the raw px/s.
   */
  map?: (velocity: number) => number
}

/**
 * An Animatable (hand it straight to bindStyle) plus its own disposer. It tracks
 * how fast the scroller is moving and relaxes to `map(0)` the moment it stops.
 */
export type VelocityValue = Animatable & Disposable

// A frame slower than this (a backgrounded tab, the loop waking from sleep) is
// not a real scroll burst; cap dt so it cannot read as a huge velocity spike.
const MAX_DT_S = 0.064

/**
 * Expose scroll velocity as one live value. Each frame it reads the scroller's
 * px/s, smooths it through a follow() spring (so it ramps and, crucially, eases
 * back to rest), and maps it to your output. The page can lean with how fast you
 * scroll - `bindStyle(el, { skewY: scroll.velocity({ map: v => clamp(v * 0.01, -6, 6) }) })`
 * - and snap upright when you stop. Physics-first: a spring owns the relax, so a
 * fresh flick mid-relax re-aims it with velocity conserved, never a restart.
 */
export function createVelocity(controller: ScrollControllerInternal, options: VelocityOptions = {}): VelocityValue {
  const source = controller.source
  const scheduler = controller.scheduler
  const policy = controller.policy
  const map = options.map ?? ((v) => v)
  const rest = map(0)
  const smooth = options.smooth ?? 0.15

  // The single returned value; the follow() bridges onto it so the reduced-motion
  // switch and dispose stay uniform, exactly like parallax.
  const out = animatable(rest, { scheduler })
  const f: Follow = follow(rest, { scheduler, stiffness: stiffnessFor(smooth), ...options.spring })
  const offFollow = f.value.on('change', (v) => out.drive({ position: v, velocity: f.value.velocity() }))

  let lastPos = source.scrollPos()
  let idle = 0
  let frameSub: (() => void) | null = null

  // While scrolling, target the smoothed value at the live px/s. When the scroller
  // is still AND the spring has rested, stop sampling (the value sits at rest).
  const sample = (frame: { deltaMs: number }): void => {
    const pos = source.scrollPos()
    const dt = Math.min(frame.deltaMs, MAX_DT_S * 1000) / 1000
    const raw = dt > 0 ? (pos - lastPos) / dt : 0
    lastPos = pos
    f.target(map(raw))
    if (raw === 0 && !f.value.isAnimating()) {
      if (++idle >= 2) {
        frameSub?.()
        frameSub = null
      }
    } else {
      idle = 0
    }
  }

  let reduced = policy.reduced()
  const wake = (): void => {
    if (reduced || frameSub !== null) return
    lastPos = source.scrollPos()
    idle = 0
    frameSub = scheduler.subscribe(sample)
  }
  const offScroll = source.onScroll(wake)

  const enterReduced = (): void => {
    frameSub?.()
    frameSub = null
    f.stop()
    out.drive({ position: rest, velocity: 0 }) // held at rest; no lean under reduced motion
  }
  if (reduced) enterReduced()
  const offPolicy = policy.onChange((next) => {
    if (next === reduced) return
    reduced = next
    if (reduced) enterReduced()
  })

  return asVelocityValue(out, () => {
    offScroll()
    offPolicy()
    offFollow()
    frameSub?.()
    f.dispose()
    out.dispose()
  })
}

// Delegate the Animatable surface to `out`, swapping in our own dispose. The
// animatable methods are this-free closures, so copying the references is safe.
function asVelocityValue(out: Animatable, dispose: () => void): VelocityValue {
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
