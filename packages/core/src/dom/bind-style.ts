import { getSharedScheduler } from '../scheduler/shared'
import type { Scheduler } from '../scheduler/scheduler'
import type { Animatable } from '../value/animatable'
import { formatTransform, TRANSFORM_KEYS, type TransformChannel, type TransformChannels } from './transform'

/** Each channel is an Animatable bound to one transform function (or opacity). */
export type StyleBindings = Partial<Record<TransformChannel, Animatable>> & {
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
  const { opacity } = bindings
  const transformBindings = TRANSFORM_KEYS.map((key) => [key, bindings[key]] as const).filter(
    (entry): entry is readonly [TransformChannel, Animatable] => entry[1] !== undefined,
  )
  const hasTransform = transformBindings.length > 0

  let transformDirty = false
  let opacityDirty = false
  let cancelFlush: (() => void) | null = null
  const unsubscribers: Array<() => void> = []

  const writeTransform = () => {
    const channels: TransformChannels = {}
    for (const [key, value] of transformBindings) channels[key] = value.get()
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
  for (const [, value] of transformBindings) track(value, markTransformDirty)
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
