import {
  bindStyle,
  onReducedMotionChange,
  prefersReducedMotion,
  type Animatable,
  type Scheduler,
  type SpringOptions,
  type StyleBindings,
} from '@underlying/core'
import { follow, type Follow } from '@underlying/core/playback'

/** Any channel `bindStyle` writes - a transform function (`x`, `y`, `scale`, `rotate`, ...), a transform-origin axis, or `opacity`. */
export type QuickChannel = keyof StyleBindings

export interface QuickToOptions {
  /** Start value before the first call (per channel for a pair). Default 0 - pass a non-zero start where 0 hides the element (`1` for `scale` or `opacity`). */
  from?: number | [number, number]
  /** The chase spring. */
  spring?: SpringOptions
  /** Frame loop; defaults to the shared rAF loop. Tests inject a manual one. */
  scheduler?: Scheduler
}

/** A one-channel fast setter. */
export interface QuickTo {
  /** Re-aim the channel toward `value` - interruptible, velocity conserved. Call it every frame; it re-aims in place, no spring rebuild. */
  (value: number): void
  /** The live driven value - read it, bind it elsewhere, compose it. */
  readonly value: Animatable
  /** Stop the spring, unbind the channel, release the frame subscription. */
  dispose(): void
}

/** A two-channel fast setter - both channels go through one `bindStyle`, so the transform never clobbers. */
export interface QuickToPair {
  /** Re-aim both channels, positionally in channel order. Re-aims in place, no spring rebuild. */
  (a: number, b: number): void
  /** The live driven values, in channel order. */
  readonly values: readonly [Animatable, Animatable]
  /** Stop the springs, unbind, release. */
  dispose(): void
}

// Snap a follow to a value with no animation, while keeping its aim in sync.
// target() re-aims (so a later retarget away from this value is not dropped) and
// wakes the loop; set() teleports the value; stop() kills the loop so nothing runs.
const snap = (f: Follow, value: number): void => {
  f.target(value)
  f.value.set(value)
  f.stop()
}

/**
 * An imperative fast setter: bind one of an element's transform channels to a spring
 * once, then drive it every frame with a plain call. Each call re-aims the spring in
 * place without rebuilding it, so it stays cheap in a hot handler. Under reduced motion
 * the value snaps instead of springing - motion removed, tracking kept.
 */
export function quickTo(element: HTMLElement, channel: QuickChannel, options?: QuickToOptions): QuickTo
/**
 * The two-channel form: both channels are driven through ONE `bindStyle`, so they never
 * clobber each other's transform - pass two distinct channels (`['x', 'y']`) together
 * rather than calling quickTo twice on the same element.
 */
export function quickTo(
  element: HTMLElement,
  channels: [QuickChannel, QuickChannel],
  options?: QuickToOptions,
): QuickToPair
export function quickTo(
  element: HTMLElement,
  channel: QuickChannel | [QuickChannel, QuickChannel],
  options: QuickToOptions = {},
): QuickTo | QuickToPair {
  const { from, spring, scheduler } = options
  const followOptions = scheduler ? { ...spring, scheduler } : { ...spring }
  const bindOptions = scheduler ? { scheduler } : undefined
  const initOf = (i: 0 | 1): number => (Array.isArray(from) ? from[i] : (from ?? 0))
  let reduced = prefersReducedMotion()
  let disposed = false

  if (typeof channel === 'string') {
    const f = follow(initOf(0), followOptions)
    const unbind = bindStyle(element, { [channel]: f.value }, bindOptions)
    let last = f.value.get()
    const set = (value: number): void => {
      if (disposed) return
      last = value
      if (reduced) snap(f, value)
      else f.target(value)
    }
    const offPolicy = onReducedMotionChange((isReduced) => {
      reduced = isReduced
      if (isReduced) snap(f, last)
    })
    return Object.assign(set, {
      value: f.value,
      dispose() {
        disposed = true
        offPolicy()
        unbind()
        f.dispose()
      },
    })
  }

  const [c0, c1] = channel
  if (c0 === c1) {
    throw new Error(`quickTo: a channel pair must be two distinct channels (got ['${c0}', '${c1}'])`)
  }
  const f0 = follow(initOf(0), followOptions)
  const f1 = follow(initOf(1), followOptions)
  const unbind = bindStyle(element, { [c0]: f0.value, [c1]: f1.value }, bindOptions)
  let last0 = f0.value.get()
  let last1 = f1.value.get()
  const set = (a: number, b: number): void => {
    if (disposed) return
    last0 = a
    last1 = b
    if (reduced) {
      snap(f0, a)
      snap(f1, b)
    } else {
      f0.target(a)
      f1.target(b)
    }
  }
  const offPolicy = onReducedMotionChange((isReduced) => {
    reduced = isReduced
    if (!isReduced) return
    snap(f0, last0)
    snap(f1, last1)
  })
  return Object.assign(set, {
    values: [f0.value, f1.value] as readonly [Animatable, Animatable],
    dispose() {
      disposed = true
      offPolicy()
      unbind()
      f0.dispose()
      f1.dispose()
    },
  })
}
