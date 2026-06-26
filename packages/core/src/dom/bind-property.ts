import { getSharedScheduler } from '../scheduler/shared'
import type { Scheduler } from '../scheduler/scheduler'
import { toKebab } from './read-style'

export interface BindPropertyOptions {
  scheduler?: Scheduler
}

/**
 * The structural source bindProperty writes: anything that can produce a CSS
 * string and notify when it changes. A ChannelGroup satisfies it (the animate()
 * path), and so does a composed template (bindTemplate) - one render-phase binder
 * serves both.
 */
export interface FormatSource {
  format(): string
  onChange(listener: () => void): () => void
}

export interface PropertyBinding {
  dispose(): void
  /** Write the current value synchronously now, cancelling any pending flush (setStyle path). */
  flushNow(): void
}

/**
 * Writes a channel group's formatted value to one element property from the
 * scheduler's render phase - bind-style's pattern, one property at a time: a
 * group change marks dirty and arms a one-shot render subscription that flushes
 * once, then lets the loop sleep. The formatted string is deduplicated, so a
 * channel that jitters below its format precision produces no DOM write at all.
 */
export function bindProperty(
  element: HTMLElement,
  property: string,
  source: FormatSource,
  options: BindPropertyOptions = {},
): PropertyBinding {
  const scheduler = options.scheduler ?? getSharedScheduler()
  const kebab = toKebab(property)
  let dirty = false
  let lastWritten: string | null = null
  let cancelFlush: (() => void) | null = null

  const write = (): void => {
    const value = source.format()
    if (value === lastWritten) return // byte-identical: no DOM write
    lastWritten = value
    element.style.setProperty(kebab, value)
  }

  const scheduleFlush = (): void => {
    if (cancelFlush !== null) return
    cancelFlush = scheduler.subscribe(() => {
      cancelFlush?.()
      cancelFlush = null
      if (dirty) {
        dirty = false
        write()
      }
    }, 'render')
  }

  const unsubscribe = source.onChange(() => {
    dirty = true
    scheduleFlush()
  })

  // The element reflects the current value synchronously at bind time.
  write()

  return {
    dispose() {
      unsubscribe()
      cancelFlush?.()
      cancelFlush = null
    },
    flushNow() {
      dirty = false
      cancelFlush?.()
      cancelFlush = null
      write()
    },
  }
}
