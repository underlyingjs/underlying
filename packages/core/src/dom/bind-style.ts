import { getSharedScheduler } from '../scheduler/shared'
import type { Scheduler } from '../scheduler/scheduler'
import type { Animatable } from '../value/animatable'
import { formatTransform, type TransformChannels } from './transform'

export interface StyleBindings {
  /** translateX, px */
  x?: Animatable
  /** translateY, px */
  y?: Animatable
  scale?: Animatable
  /** degrees */
  rotate?: Animatable
  opacity?: Animatable
}

export interface BindStyleOptions {
  /** Must be the scheduler driving the bound animatables. Defaults to the shared one. */
  scheduler?: Scheduler
}

/**
 * Writes animatable values straight to element.style from the scheduler's
 * render phase - outside any framework reactivity. All channels that moved
 * during a frame are flushed in a single write per property, per element.
 * Returns a dispose function.
 */
export function bindStyle(
  element: HTMLElement,
  bindings: StyleBindings,
  options: BindStyleOptions = {},
): () => void {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const { x, y, scale, rotate, opacity } = bindings
  const hasTransform =
    x !== undefined || y !== undefined || scale !== undefined || rotate !== undefined

  let transformDirty = false
  let opacityDirty = false
  let cancelFlush: (() => void) | null = null
  const unsubscribers: Array<() => void> = []

  const writeTransform = () => {
    const channels: TransformChannels = {}
    if (x !== undefined) channels.x = x.get()
    if (y !== undefined) channels.y = y.get()
    if (scale !== undefined) channels.scale = scale.get()
    if (rotate !== undefined) channels.rotate = rotate.get()
    element.style.transform = formatTransform(channels)
  }

  const writeOpacity = () => {
    if (opacity !== undefined) element.style.opacity = String(opacity.get())
  }

  const flush = () => {
    if (transformDirty) {
      transformDirty = false
      writeTransform()
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
  track(x, markTransformDirty)
  track(y, markTransformDirty)
  track(scale, markTransformDirty)
  track(rotate, markTransformDirty)
  track(opacity, () => {
    opacityDirty = true
  })

  // The element reflects the current values from bind time, synchronously.
  if (hasTransform) writeTransform()
  writeOpacity()

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
    cancelFlush?.()
    cancelFlush = null
  }
}
