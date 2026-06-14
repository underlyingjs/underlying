import type { Box } from './range'
import type { ScrollSource } from './source'

export interface DomScrollSourceOptions {
  /** The scroll container. Omit for the viewport (window). */
  scroller?: HTMLElement
  axis?: 'x' | 'y'
}

/**
 * The production ScrollSource. Every browser global is touched only inside this
 * factory (first called from the controller's lazy ensureSource), never at
 * module load, so importing the package is SSR-safe. The scroll position is
 * cached on each passive scroll event; layout (size, getBoundingClientRect) is
 * read on demand, which the Track only does on measure/refresh.
 */
export function createDomScrollSource(options: DomScrollSourceOptions = {}): ScrollSource {
  const axis = options.axis ?? 'y'
  const vertical = axis === 'y'
  const scroller = options.scroller ?? null
  const win = window
  const target: EventTarget = scroller ?? win

  const readPos = (): number =>
    scroller
      ? vertical
        ? scroller.scrollTop
        : scroller.scrollLeft
      : vertical
        ? win.scrollY
        : win.scrollX

  let pos = readPos()
  const scrollListeners = new Set<() => void>()
  const resizeListeners = new Set<() => void>()

  const onScrollEvent = (): void => {
    pos = readPos()
    for (const listener of [...scrollListeners]) listener()
  }
  const onResizeEvent = (): void => {
    for (const listener of [...resizeListeners]) listener()
  }

  target.addEventListener('scroll', onScrollEvent, { passive: true })
  win.addEventListener('resize', onResizeEvent)
  const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResizeEvent) : null
  resizeObserver?.observe(scroller ?? document.documentElement)

  const viewportSize = (): number =>
    scroller
      ? vertical
        ? scroller.clientHeight
        : scroller.clientWidth
      : vertical
        ? win.innerHeight
        : win.innerWidth

  const scrollSize = (): number => {
    const el = scroller ?? document.documentElement
    return vertical ? el.scrollHeight : el.scrollWidth
  }

  return {
    scrollPos: () => pos,
    viewportSize,
    maxScroll: () => Math.max(0, scrollSize() - viewportSize()),
    measure(el): Box {
      const r = el.getBoundingClientRect()
      if (scroller) {
        // Element scroller: rect is viewport-relative; shift into the scroller's content coords.
        const sr = scroller.getBoundingClientRect()
        return vertical
          ? { start: r.top - sr.top + scroller.scrollTop, size: r.height }
          : { start: r.left - sr.left + scroller.scrollLeft, size: r.width }
      }
      return vertical ? { start: r.top + win.scrollY, size: r.height } : { start: r.left + win.scrollX, size: r.width }
    },
    scrollTo(next) {
      const opts: ScrollToOptions = vertical ? { top: next } : { left: next }
      if (scroller) scroller.scrollTo(opts)
      else win.scrollTo(opts)
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
      target.removeEventListener('scroll', onScrollEvent)
      win.removeEventListener('resize', onResizeEvent)
      resizeObserver?.disconnect()
      scrollListeners.clear()
      resizeListeners.clear()
    },
  }
}
