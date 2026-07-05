import type { Scheduler, SpringOptions } from '@underlying/core'
import { flip } from './flip'
import { isHTMLElement, measure, states, writeTransform, type Box } from './engine'

export type { Box } from './engine'

/** Which axis the list runs along. 'both' = a wrapping grid (nearest slot in 2D). */
export type ReorderAxis = 'x' | 'y' | 'both'

export interface ReorderOptions extends SpringOptions {
  /** CSS selector for the draggable items within the container. Default: the element children. */
  items?: string
  /** The list axis. 'y' (default) = vertical, 'x' = horizontal, 'both' = a grid. */
  axis?: ReorderAxis
  /** CSS selector for a drag handle inside each item. Default: the whole item is the handle. */
  handle?: string
  /** Fired after the order changes (each swap during the drag, and the final drop). */
  onReorder?: (event: ReorderEvent) => void
  scheduler?: Scheduler
}

export interface ReorderEvent {
  /** The item being dragged. */
  readonly item: HTMLElement
  /** Its index before this change. */
  readonly from: number
  /** Its index after this change. */
  readonly to: number
  /** The full item list in its new order. */
  readonly order: readonly HTMLElement[]
}

export interface Reorder {
  /** The items in their current DOM order. */
  order(): HTMLElement[]
  /** Remove the listeners and restore touch-action. */
  dispose(): void
}

/** Move `arr[from]` to index `to`, returning a new array. Pure. */
export function moveItem<T>(arr: readonly T[], from: number, to: number): T[] {
  const out = arr.slice()
  const [moved] = out.splice(from, 1)
  if (moved !== undefined) out.splice(to, 0, moved)
  return out
}

/** The center of a box along an axis. */
const centerX = (b: Box): number => b.left + b.width / 2
const centerY = (b: Box): number => b.top + b.height / 2

/**
 * Where the dragged item's center belongs among the OTHER items' (layout) centers.
 * For a single axis, that's the insertion index by center along that axis. For a
 * grid ('both'), it's the index of the nearest center in 2D. Pure over the boxes,
 * so it is unit-testable without a layout engine.
 *
 * `others` are the non-dragged item boxes in current visual order; the returned
 * index is where the dragged item should sit in the FULL list (0..others.length).
 */
export function computeTargetIndex(dragged: Box, others: readonly Box[], axis: ReorderAxis): number {
  if (axis === 'both') {
    // Nearest center in 2D, then insert before/after it by which side we're on.
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY
    const dx0 = centerX(dragged)
    const dy0 = centerY(dragged)
    for (let i = 0; i < others.length; i += 1) {
      const o = others[i] as Box
      const d = (centerX(o) - dx0) ** 2 + (centerY(o) - dy0) ** 2
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    // Insert after the nearest if the dragged center is past it in reading order.
    const near = others[best]
    if (near !== undefined && (centerY(dragged) > centerY(near) || (centerY(dragged) === centerY(near) && dx0 > centerX(near)))) {
      return best + 1
    }
    return best
  }
  const center = axis === 'x' ? centerX : centerY
  const dc = center(dragged)
  let index = 0
  for (const o of others) {
    if (center(o) < dc) index += 1
    else break
  }
  return index
}

/** The item's LAYOUT box: its live rect minus any in-flight FLIP transform (so it is stable mid-animation). */
const layoutBox = (element: HTMLElement): Box => {
  const box = measure(element)
  const state = states.get(element)
  if (state === undefined) return box
  return { left: box.left - state.x.get(), top: box.top - state.y.get(), width: box.width, height: box.height }
}

interface DragState {
  item: HTMLElement
  pointerId: number
  grabX: number
  grabY: number
  from: number
  startIndex: number
  lastX: number
  lastY: number
}

/**
 * Drag-to-reorder a list or grid. Drag an item (or its `handle`) and the displaced
 * siblings FLIP-animate to their new slots; on drop the dragged item springs into
 * place. Built on `flip()`: each reorder measures the siblings, mutates the DOM
 * order, and springs them - the dragged item is excluded and kept under the pointer
 * across the mutation. `onReorder` reports every order change. Off under no options
 * beyond the list container. Physics-first: interrupt a drag any time.
 */
export function reorder(container: HTMLElement, options: ReorderOptions = {}): Reorder {
  const axis = options.axis ?? 'y'

  const collect = (): HTMLElement[] => {
    const found = options.items ? container.querySelectorAll(options.items) : container.children
    return Array.from(found).filter(isHTMLElement)
  }
  let items = collect()

  // touch-action:none on each handle so a drag never scrolls the page.
  const restore: Array<() => void> = []
  for (const item of items) {
    const handle = options.handle ? item.querySelector<HTMLElement>(options.handle) : item
    if (handle === null) continue
    const previous = handle.style.touchAction
    handle.style.touchAction = 'none'
    restore.push(() => {
      handle.style.touchAction = previous
    })
  }

  let active: DragState | null = null

  // Keep the dragged item's top-left under (pointer - grab), re-measuring its layout
  // so it stays put across the DOM mutations a reorder makes. Constrained to the axis.
  const positionDragged = (clientX: number, clientY: number): void => {
    const drag = active
    if (drag === null) return
    const item = drag.item
    item.style.transform = ''
    const layout = item.getBoundingClientRect()
    const tx = axis === 'y' ? 0 : clientX - drag.grabX - layout.left
    const ty = axis === 'x' ? 0 : clientY - drag.grabY - layout.top
    writeTransform(item, tx, ty, 1, 1)
  }

  const applyDomOrder = (order: readonly HTMLElement[]): void => {
    for (const item of order) container.append(item) // append moves in place, in order
  }

  const swapTo = (to: number): void => {
    const drag = active
    if (drag === null) return
    const from = drag.from
    const item = drag.item
    const next = moveItem(items, from, to)
    const siblings = items.filter((it) => it !== item)
    flip(
      siblings,
      () => {
        applyDomOrder(next)
        positionDragged(drag.lastX, drag.lastY) // re-anchor to the pointer in the new layout
      },
      options,
    )
    items = next
    drag.from = to
    options.onReorder?.({ item, from, to, order: next.slice() })
  }

  const onMove = (event: PointerEvent): void => {
    const drag = active
    if (drag === null || event.pointerId !== drag.pointerId) return
    drag.lastX = event.clientX
    drag.lastY = event.clientY
    positionDragged(event.clientX, event.clientY)
    const dragged = measure(drag.item)
    const others = items.filter((it) => it !== drag.item).map(layoutBox)
    const to = computeTargetIndex(dragged, others, axis)
    if (to !== drag.from) swapTo(to)
  }

  const endDrag = (): void => {
    if (active === null) return
    const { item, pointerId } = active
    item.removeEventListener('pointermove', onMove)
    item.removeEventListener('pointerup', endDrag)
    item.removeEventListener('pointercancel', endDrag)
    try {
      item.releasePointerCapture(pointerId)
    } catch {
      // no active capture (synthetic events / older engines)
    }
    // Settle the dragged item into its slot with a spring (FLIP, no mutation).
    flip(item, () => {}, options)
    item.style.zIndex = ''
    delete item.dataset.reorderDragging
    active = null
  }

  const onDown = (event: PointerEvent): void => {
    if (active !== null || event.button > 0) return
    const target = event.target as Node
    const item = items.find((it) => it.contains(target))
    if (item === undefined) return
    if (options.handle !== undefined) {
      const handle = item.querySelector(options.handle)
      if (handle === null || !handle.contains(target)) return
    }
    const from = items.indexOf(item)
    const state = states.get(item)
    if (state !== undefined) {
      // Drop any residual FLIP so we can drive the transform directly.
      state.x.stop()
      state.y.stop()
      state.sx.stop()
      state.sy.stop()
    }
    active = { item, pointerId: event.pointerId, grabX: 0, grabY: 0, from, startIndex: from, lastX: event.clientX, lastY: event.clientY }
    const rect = item.getBoundingClientRect()
    active.grabX = event.clientX - rect.left
    active.grabY = event.clientY - rect.top
    try {
      item.setPointerCapture(event.pointerId)
    } catch {
      // ignore (synthetic events)
    }
    item.style.zIndex = '1'
    item.dataset.reorderDragging = ''
    writeTransform(item, 0, 0, 1, 1)
    item.addEventListener('pointermove', onMove)
    item.addEventListener('pointerup', endDrag)
    item.addEventListener('pointercancel', endDrag)
    event.preventDefault()
  }

  container.addEventListener('pointerdown', onDown)

  return {
    order: () => items.slice(),
    dispose() {
      container.removeEventListener('pointerdown', onDown)
      if (active !== null) endDrag()
      for (const undo of restore) undo()
    },
  }
}
