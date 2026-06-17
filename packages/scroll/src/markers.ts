import type { ScrollControllerInternal } from './controller'
import {
  type Box,
  DEFAULT_RANGE,
  offsetEdges,
  type OffsetEntry,
  resolveOffset,
  type ScrollRange,
} from './range'
import type { Disposable } from './types'

export interface MarkerOptions {
  /** Element whose range is drawn. Omit to mark the scroller's own start/end band. */
  target?: HTMLElement
  /** Range whose enter/leave edges are shown. Default the standard `['start end','end start']`. */
  range?: ScrollRange
  /** Colour of the enter edge and its scroller line. Default sapin. */
  enterColor?: string
  /** Colour of the leave edge and its scroller line. Default lichen. */
  leaveColor?: string
  /** Short prefix on every label (e.g. a section name). */
  label?: string
}

/** One side of a range, resolved for markers. */
export interface MarkerEdge {
  /** Content-coordinate position of the element edge, or null when there is no element line. */
  readonly content: number | null
  /** Viewport fraction where this edge's crossing reads (0..1), or null for a numeric/`%`/`px` offset. */
  readonly viewport: number | null
}

/**
 * Pure marker geometry for a target box: each side gives a content line (the
 * element edge, which scrolls with the page) and - for an `'<edge> <edge>'`
 * offset - a viewport fraction (the fixed line the crossing reads against).
 * Numeric/`%`/`px` offsets name a scroll position, so they yield a content line
 * only.
 */
export function markerGeometry(box: Box, viewport: number, range: ScrollRange): { enter: MarkerEdge; leave: MarkerEdge } {
  const edge = (entry: OffsetEntry): MarkerEdge => {
    const edges = offsetEdges(entry)
    if (edges) return { content: box.start + edges.elem * box.size, viewport: edges.viewport }
    return { content: resolveOffset(entry, box, viewport), viewport: null }
  }
  return { enter: edge(range[0]), leave: edge(range[1]) }
}

interface Mark {
  readonly line: HTMLElement
  readonly kind: 'content' | 'viewport'
  readonly at: number
}

/**
 * Dev markers. Draws, into a fixed body overlay, the
 * element's enter/leave edges (solid lines that travel with the content) and
 * the scroller positions they fire against (dashed, fixed in the viewport).
 * When a solid line meets a dashed one of the same colour, that edge fires.
 * Works against the window or an element scroller, on either axis. Dev-only -
 * it reads the DOM live; never ship it on.
 */
export function createMarkers(controller: ScrollControllerInternal, options: MarkerOptions = {}): Disposable {
  const source = controller.source
  const root = controller.root
  const vertical = controller.axis === 'y'
  const range = options.range ?? DEFAULT_RANGE
  const target = options.target
  const enterColor = options.enterColor ?? '#1c3426' // sapin
  const leaveColor = options.leaveColor ?? '#8c948c' // lichen
  const prefix = options.label ? `${options.label} ` : ''

  const layer = document.createElement('div')
  layer.setAttribute('data-underlying-markers', '')
  layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;'
  document.body.append(layer)

  const addLine = (color: string, dashed: boolean, text: string): HTMLElement => {
    const stroke = `1px ${dashed ? 'dashed' : 'solid'} ${color}`
    const line = document.createElement('div')
    line.style.cssText = vertical
      ? `position:fixed;height:0;border-top:${stroke};opacity:0.92;`
      : `position:fixed;width:0;border-left:${stroke};opacity:0.92;`
    const tag = document.createElement('span')
    tag.textContent = text
    tag.style.cssText =
      'position:absolute;font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;' +
      `color:${color};background:#faf9f6;padding:0 4px;white-space:nowrap;` +
      (vertical ? 'right:6px;top:0;transform:translateY(-50%);' : 'left:0;top:6px;transform:translateX(-50%);')
    line.append(tag)
    layer.append(line)
    return line
  }

  const marks: Mark[] = []
  const add = (at: number | null, kind: Mark['kind'], color: string, dashed: boolean, text: string): void => {
    if (at === null) return
    marks.push({ line: addLine(color, dashed, text), kind, at })
  }

  const build = (): void => {
    for (const m of marks) m.line.remove()
    marks.length = 0
    if (target) {
      const geo = markerGeometry(source.measure(target), source.viewportSize(), range)
      add(geo.enter.content, 'content', enterColor, false, `${prefix}start`)
      add(geo.leave.content, 'content', leaveColor, false, `${prefix}end`)
      add(geo.enter.viewport, 'viewport', enterColor, true, 'scroller')
      add(geo.leave.viewport, 'viewport', leaveColor, true, 'scroller')
    } else {
      add(0, 'viewport', enterColor, true, `${prefix}start`)
      add(1, 'viewport', leaveColor, true, `${prefix}end`)
    }
  }

  const reposition = (): void => {
    const scrollPos = source.scrollPos()
    const vpSize = source.viewportSize()
    let vpStart: number
    let crossStart: number
    let crossSize: number
    if (root) {
      const r = root.getBoundingClientRect()
      vpStart = vertical ? r.top : r.left
      crossStart = vertical ? r.left : r.top
      crossSize = vertical ? r.width : r.height
    } else {
      vpStart = 0
      crossStart = 0
      crossSize = vertical ? window.innerWidth : window.innerHeight
    }
    // getBoundingClientRect is a border-box origin, but viewportSize() (clientH/W)
    // and the IntersectionObserver triggers fire against are CONTENT-box. Offset
    // only the fixed scroller lines by the leading border so the dashed band lands
    // where the trigger actually fires; content lines stay glued to the real edge.
    const vpBorder = root ? (vertical ? root.clientTop : root.clientLeft) : 0
    for (const m of marks) {
      const along = m.kind === 'viewport' ? vpStart + vpBorder + m.at * vpSize : vpStart + (m.at - scrollPos)
      if (vertical) {
        m.line.style.top = `${along}px`
        m.line.style.left = `${crossStart}px`
        m.line.style.width = `${crossSize}px`
      } else {
        m.line.style.left = `${along}px`
        m.line.style.top = `${crossStart}px`
        m.line.style.height = `${crossSize}px`
      }
    }
  }

  build()
  reposition()
  const offScroll = source.onScroll(reposition)
  const offResize = source.onResize(() => {
    build()
    reposition()
  })
  // An element scroller's on-screen rect also shifts when an ANCESTOR scrolls,
  // so track window scroll (capture) and resize too.
  const onWindow = (): void => reposition()
  window.addEventListener('scroll', onWindow, { passive: true, capture: true })
  window.addEventListener('resize', onWindow)

  return {
    dispose() {
      offScroll()
      offResize()
      window.removeEventListener('scroll', onWindow, { capture: true })
      window.removeEventListener('resize', onWindow)
      layer.remove()
    },
  }
}
