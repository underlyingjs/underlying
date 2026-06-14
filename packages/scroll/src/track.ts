import { clamp01, DEFAULT_RANGE, rawProgress, resolveRange, type ScrollRange } from './range'
import type { ScrollSource } from './source'

/** Normalized 0..1 progress over a scroll range. A value, not a handle - every consumer takes one. */
export interface Track {
  /** Latest progress, clamped 0..1. Read synchronously. */
  progress(): number
  /** Raw (unclamped) progress; < 0 before the range, > 1 after. For trigger/pin edge logic. */
  raw(): number
  /** Subscribe to progress changes (deduped: fires only when the clamped value moves). */
  on(listener: (p: number) => void): () => void
  /** Re-measure this track's box (called by the controller on refresh/resize). */
  refresh(): void
  dispose(): void
}

/** The controller drives sampling once per frame; not part of the public surface. */
export interface TrackInternal extends Track {
  sample(): void
}

export interface TrackOptions {
  /** The element whose box defines the range. Omit for the whole scroller (0..maxScroll). */
  target?: HTMLElement
  range?: ScrollRange
}

export function createTrack(source: ScrollSource, options: TrackOptions = {}): TrackInternal {
  const range = options.range ?? DEFAULT_RANGE
  const target = options.target
  let enter = 0
  let leave = 0
  let last = Number.NaN // force the first sample to emit
  const listeners = new Set<(p: number) => void>()

  const measure = (): void => {
    if (target === undefined) {
      enter = 0
      leave = source.maxScroll()
    } else {
      const r = resolveRange(range, source.measure(target), source.viewportSize())
      enter = r.enter
      leave = r.leave
    }
  }
  measure()

  const raw = (): number => rawProgress(source.scrollPos(), enter, leave)
  const progress = (): number => clamp01(raw())

  const sample = (): void => {
    const p = progress()
    if (p === last) return
    last = p
    for (const listener of [...listeners]) listener(p)
  }

  return {
    progress,
    raw,
    on(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    refresh() {
      measure()
      sample()
    },
    dispose() {
      listeners.clear()
    },
    sample,
  }
}
