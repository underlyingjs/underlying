import type { Box } from './range'
import type { ScrollSource } from './source'

/** A ScrollSource driven by injected numbers - the deterministic test/SSR seam (sibling to core's createManualDriver). */
export interface ManualScrollSource extends ScrollSource {
  /** Set the scroll position and fire onScroll listeners. */
  emitScroll(pos: number): void
  /** Fire onResize listeners (a re-measure pass). */
  emitResize(): void
  /** Inject an element's box (content coords). */
  setBox(el: HTMLElement, box: Box): void
  /** Set viewport length and/or maxScroll. */
  setLayout(layout: { viewportSize?: number; maxScroll?: number }): void
}

export interface ManualScrollInit {
  scrollPos?: number
  viewportSize?: number
  maxScroll?: number
  boxes?: ReadonlyMap<HTMLElement, Box>
}

export function createManualScrollSource(initial: ManualScrollInit = {}): ManualScrollSource {
  let pos = initial.scrollPos ?? 0
  let viewport = initial.viewportSize ?? 0
  let max = initial.maxScroll ?? 0
  const boxes = new Map<HTMLElement, Box>(initial.boxes ?? [])
  const scrollListeners = new Set<() => void>()
  const resizeListeners = new Set<() => void>()

  return {
    scrollPos: () => pos,
    viewportSize: () => viewport,
    maxScroll: () => max,
    measure: (el) => boxes.get(el) ?? { start: 0, size: 0 },
    scrollTo(next) {
      pos = next
      for (const listener of [...scrollListeners]) listener()
    },
    driveTo(next) {
      pos = next
      for (const listener of [...scrollListeners]) listener()
    },
    onScroll(listener) {
      scrollListeners.add(listener)
      return () => {
        scrollListeners.delete(listener)
      }
    },
    onResize(listener) {
      resizeListeners.add(listener)
      return () => {
        resizeListeners.delete(listener)
      }
    },
    dispose() {
      scrollListeners.clear()
      resizeListeners.clear()
    },
    emitScroll(next) {
      pos = next
      for (const listener of [...scrollListeners]) listener()
    },
    emitResize() {
      for (const listener of [...resizeListeners]) listener()
    },
    setBox(el, box) {
      boxes.set(el, box)
    },
    setLayout(layout) {
      if (layout.viewportSize !== undefined) viewport = layout.viewportSize
      if (layout.maxScroll !== undefined) max = layout.maxScroll
    },
  }
}
