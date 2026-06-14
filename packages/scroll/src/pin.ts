import type { ScrollControllerInternal } from './controller'
import { DEFAULT_RANGE, resolveRange, type ScrollRange } from './range'
import type { Track } from './track'
import type { Disposable } from './types'

export interface PinOptions {
  range?: ScrollRange
  /** Reserve layout space so following content does not jump. Default true. */
  spacing?: boolean | 'margin'
  /** Re-parent to <body> to escape a transformed ancestor that breaks fixed. Default false. */
  reparent?: boolean
  onEnter?(): void
  onLeave?(): void
}

export interface Pin extends Disposable {
  /** 0..1 progress THROUGH the pinned span. Feed nested scrubs: scrub({ track: pin.track }). */
  readonly track: Track
  refresh(): void
}

type Phase = 'before' | 'during' | 'after'

/**
 * Pin an element across a range. Geometry + style only, no physics. The element
 * is wrapped in a spacer that holds its vacated layout space; while the pin
 * track's raw() sits in (0,1) the element is position:fixed, before it is
 * static, after it rests at the bottom of the spacer. We measure from the
 * spacer (in flow), never the element while it is fixed.
 */
export function createPin(
  controller: ScrollControllerInternal,
  element: HTMLElement,
  options: PinOptions = {},
): Pin {
  const axis = controller.axis
  const source = controller.source
  const range = options.range ?? DEFAULT_RANGE
  const spacing = options.spacing ?? true
  const reparent = options.reparent ?? false
  const doc = element.ownerDocument

  const sizeProp: 'height' | 'width' = axis === 'y' ? 'height' : 'width'
  const offsetProp: 'top' | 'left' = axis === 'y' ? 'top' : 'left'
  const marginProp: 'marginBottom' | 'marginRight' = axis === 'y' ? 'marginBottom' : 'marginRight'

  // Measure the natural box BEFORE touching layout; the span sets the spacer.
  const box = source.measure(element)
  const span = resolveRange(range, box, source.viewportSize())
  const pinDuration = Math.max(0, span.leave - span.enter)

  // Wrap the element in a spacer that props open the vacated space.
  const spacer = doc.createElement('div')
  spacer.style[sizeProp] = `${box.size + (spacing === true ? pinDuration : 0)}px`
  if (spacing === 'margin') spacer.style[marginProp] = `${pinDuration}px`
  element.parentNode?.insertBefore(spacer, element)
  spacer.appendChild(element)

  const track = controller.track({ target: spacer, range })
  let phase: Phase | null = null

  const clearStyles = (): void => {
    element.style.position = ''
    element.style.top = ''
    element.style.left = ''
    element.style.width = ''
    element.style.height = ''
  }
  const restoreToSpacer = (): void => {
    if (reparent && element.parentNode === doc.body) spacer.appendChild(element)
  }

  const enterPinned = (): void => {
    if (reparent && element.parentNode !== doc.body) doc.body.appendChild(element)
    const rect = element.getBoundingClientRect()
    element.style.width = `${rect.width}px`
    element.style.height = `${rect.height}px`
    element.style.top = `${rect.top}px`
    element.style.left = `${rect.left}px`
    element.style.position = 'fixed' // after the snapshot, never measured again while fixed
  }
  const releaseAfter = (): void => {
    restoreToSpacer()
    clearStyles()
    element.style.position = 'absolute'
    element.style[offsetProp] = `${pinDuration}px` // rest at the bottom of the spacer
  }
  const releaseBefore = (): void => {
    restoreToSpacer()
    clearStyles()
  }

  const apply = (): void => {
    const r = track.raw()
    const next: Phase = r <= 0 ? 'before' : r >= 1 ? 'after' : 'during'
    if (next === phase) return
    const wasDuring = phase === 'during'
    phase = next
    if (next === 'during') {
      enterPinned()
      options.onEnter?.()
    } else {
      if (next === 'after') releaseAfter()
      else releaseBefore()
      if (wasDuring) options.onLeave?.()
    }
  }

  const off = track.on(apply)

  return {
    track,
    refresh() {
      track.refresh()
    },
    dispose() {
      off()
      restoreToSpacer()
      clearStyles()
      const parent = spacer.parentNode
      if (parent) {
        parent.insertBefore(element, spacer)
        parent.removeChild(spacer)
      }
      track.dispose()
    },
  }
}
