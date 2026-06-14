import type { Box } from './range'

/**
 * The one DOM-coupled contract. The production impl (source-dom.ts) reads the
 * real DOM lazily; createManualScrollSource (source-manual.ts) implements it
 * with injected numbers for tests and SSR. All progress math (range.ts) is a
 * pure function of (box, viewport, scrollPos), so it never sees the difference.
 */
export interface ScrollSource {
  /** Current scroll offset of the scroller on the active axis, px. Cached; cheap to call. */
  scrollPos(): number
  /** Viewport length on the active axis, px. */
  viewportSize(): number
  /** Total scrollable length (scrollSize - viewportSize), px. For whole-scroller progress. */
  maxScroll(): number
  /** Measure an element's box on the active axis (content coords). Reads layout; call only on refresh. */
  measure(el: HTMLElement): Box
  /** Imperatively move the scroller on the active axis (snap, programmatic). Fires onScroll. */
  scrollTo(pos: number): void
  /** Subscribe to scroll movement. */
  onScroll(listener: () => void): () => void
  /** Subscribe to layout change (triggers a re-measure). */
  onResize(listener: () => void): () => void
  /** Release listeners/observers. */
  dispose(): void
}
