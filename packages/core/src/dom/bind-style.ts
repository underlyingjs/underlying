import { getSharedScheduler } from '../scheduler/shared'
import type { Scheduler } from '../scheduler/scheduler'
import type { Animatable } from '../value/animatable'
import type { AnimatableElement } from './resolve-target'
import {
  formatOrigin,
  formatTransform,
  ORIGIN_KEYS,
  TRANSFORM_KEYS,
  type OriginChannel,
  type OriginChannels,
  type TransformChannel,
  type TransformChannels,
} from './transform'

/** Each channel is an Animatable bound to one transform function, transform-origin axis, or opacity. */
export type StyleBindings = Partial<Record<TransformChannel | OriginChannel, Animatable>> & {
  opacity?: Animatable
}

export interface BindStyleOptions {
  /** Must be the scheduler driving the bound animatables. Defaults to the shared one. */
  scheduler?: Scheduler
  /**
   * When set, the opacity write also toggles `visibility` - `hidden` at 0, cleared
   * otherwise - so a fully transparent element stops capturing pointer events (the
   * autoAlpha behavior). No effect without an opacity binding.
   */
  autoAlpha?: boolean
}

/**
 * Writes animatable values straight to element.style from the scheduler's
 * render phase - outside any framework reactivity. All channels that moved
 * during a frame are flushed in a single write per property, per element.
 * Returns a dispose function.
 */
export function bindStyle(
  element: AnimatableElement,
  bindings: StyleBindings,
  options: BindStyleOptions = {},
): () => void {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const autoAlpha = options.autoAlpha === true
  const { opacity } = bindings
  const transformBindings = TRANSFORM_KEYS.map((key) => [key, bindings[key]] as const).filter(
    (entry): entry is readonly [TransformChannel, Animatable] => entry[1] !== undefined,
  )
  const originBindings = ORIGIN_KEYS.map((key) => [key, bindings[key]] as const).filter(
    (entry): entry is readonly [OriginChannel, Animatable] => entry[1] !== undefined,
  )

  let transformDirty = false
  let originDirty = false
  let opacityDirty = false
  let cancelFlush: (() => void) | null = null
  const unsubscribers: Array<() => void> = []

  const writeTransform = () => {
    const channels: TransformChannels = {}
    for (const [key, value] of transformBindings) channels[key] = value.get()
    element.style.transform = formatTransform(channels)
  }

  const writeOrigin = () => {
    const channels: OriginChannels = {}
    for (const [key, value] of originBindings) channels[key] = value.get()
    element.style.transformOrigin = formatOrigin(channels)
  }

  const writeOpacity = () => {
    if (opacity === undefined) return
    const value = opacity.get()
    element.style.opacity = String(value)
    // autoAlpha: a fully transparent element also goes visibility:hidden so it
    // drops out of hit-testing; any non-zero opacity clears it back to visible.
    if (autoAlpha) element.style.visibility = value <= 0.0001 ? 'hidden' : ''
  }

  const flush = () => {
    if (transformDirty) {
      transformDirty = false
      writeTransform()
    }
    if (originDirty) {
      originDirty = false
      writeOrigin()
    }
    if (opacityDirty) {
      opacityDirty = false
      writeOpacity()
    }
  }

  // One-shot render subscription: the flush runs after every simulation of
  // the same tick (or on the next frame for changes made outside a tick),
  // then lets the loop go back to sleep.
  const scheduleFlush = () => {
    if (cancelFlush !== null) return
    cancelFlush = scheduler.subscribe(() => {
      cancelFlush?.()
      cancelFlush = null
      flush()
    }, 'render')
  }

  const track = (value: Animatable | undefined, markDirty: () => void) => {
    if (value === undefined) return
    unsubscribers.push(
      value.on('change', () => {
        markDirty()
        scheduleFlush()
      }),
    )
  }

  const markTransformDirty = () => {
    transformDirty = true
  }
  const markOriginDirty = () => {
    originDirty = true
  }
  for (const [, value] of transformBindings) track(value, markTransformDirty)
  for (const [, value] of originBindings) track(value, markOriginDirty)
  track(opacity, () => {
    opacityDirty = true
  })

  // The element reflects the current values from bind time, synchronously.
  if (transformBindings.length > 0) writeTransform()
  if (originBindings.length > 0) writeOrigin()
  writeOpacity()

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
    cancelFlush?.()
    cancelFlush = null
  }
}
