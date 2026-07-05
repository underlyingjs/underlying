// @vitest-environment jsdom
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { computeTargetIndex, moveItem, reorder, type Box } from './reorder'

const box = (left: number, top: number, width = 100, height = 40): Box => ({ left, top, width, height })

describe('moveItem', () => {
  it('moves an element forward and backward, leaving a new array', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
    const arr = ['a', 'b']
    expect(moveItem(arr, 0, 1)).not.toBe(arr) // pure
  })
})

describe('computeTargetIndex', () => {
  it('inserts by center along the y axis', () => {
    // others (siblings) stacked vertically at centers 20, 60, 100.
    const others = [box(0, 0), box(0, 40), box(0, 80)]
    expect(computeTargetIndex(box(0, -30), others, 'y')).toBe(0) // above all
    expect(computeTargetIndex(box(0, 30), others, 'y')).toBe(1) // center 50, past the first
    expect(computeTargetIndex(box(0, 200), others, 'y')).toBe(3) // below all
  })

  it('inserts by center along the x axis', () => {
    const others = [box(0, 0), box(40, 0), box(80, 0)]
    expect(computeTargetIndex(box(50, 0), others, 'x')).toBe(2) // center 100, past first two
  })

  it('finds the nearest slot in a grid (both)', () => {
    // a 2x2 grid of centers (20,20) (120,20) (20,120) (120,120)
    const others = [box(0, 0), box(100, 0), box(0, 100)]
    // dragged near the bottom-left cell, below its center -> after it
    expect(computeTargetIndex(box(0, 110), others, 'both')).toBe(3)
  })
})

// --- Orchestration in jsdom (no real layout): mock rects from DOM index + transform ---

function parseTranslate(transform: string): { x: number; y: number } {
  const m = /translate3d\((-?[\d.]+)px, (-?[\d.]+)px/.exec(transform)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 }
}

/** Give each item a rect derived from its current DOM index (layout) plus its transform (visual). */
function mockLayout(container: HTMLElement, h = 40): void {
  for (const el of Array.from(container.children) as HTMLElement[]) {
    el.getBoundingClientRect = () => {
      const idx = Array.from(container.children).indexOf(el)
      const t = parseTranslate(el.style.transform)
      const top = idx * h + t.y
      const left = t.x
      return { left, top, right: left + 100, bottom: top + h, width: 100, height: h, x: left, y: top, toJSON() {} } as DOMRect
    }
  }
}

function pointer(el: HTMLElement, type: string, y: number, id = 1): void {
  const ev = new MouseEvent(type, { clientX: 50, clientY: y, button: 0, bubbles: true, cancelable: true })
  Object.defineProperty(ev, 'pointerId', { value: id })
  el.dispatchEvent(ev)
}

function setup(count = 3) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const container = document.createElement('div')
  const items: HTMLElement[] = []
  for (let i = 0; i < count; i += 1) {
    const el = document.createElement('div')
    el.textContent = String(i)
    container.append(el)
    items.push(el)
  }
  document.body.append(container)
  mockLayout(container)
  return { container, items, scheduler, driver }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('reorder() orchestration', () => {
  it('reorders the DOM and fires onReorder when an item is dragged past a sibling', () => {
    const { container, items, scheduler } = setup(3)
    const events: Array<{ from: number; to: number }> = []
    const r = reorder(container, { scheduler, onReorder: (e) => events.push({ from: e.from, to: e.to }) })

    // Grab item 0 at its center (y=20) and drag down past item 1's center (to y~90).
    pointer(items[0]!, 'pointerdown', 20)
    pointer(items[0]!, 'pointermove', 90)
    pointer(items[0]!, 'pointerup', 90)

    expect(events).toContainEqual({ from: 0, to: 1 })
    expect(r.order().map((el) => el.textContent)).toEqual(['1', '0', '2'])
    expect(Array.from(container.children).map((el) => el.textContent)).toEqual(['1', '0', '2'])
    r.dispose()
  })

  it('respects a drag handle (a pointerdown outside the handle does nothing)', () => {
    const { container, items, scheduler } = setup(3)
    const handle = document.createElement('span')
    handle.className = 'grip'
    items[0]!.append(handle)
    const events: number[] = []
    const r = reorder(container, { scheduler, handle: '.grip', onReorder: () => events.push(1) })

    // pointerdown on the item body (not the handle) -> no drag.
    pointer(items[0]!, 'pointerdown', 20)
    pointer(items[0]!, 'pointermove', 90)
    expect(events).toHaveLength(0)
    expect(r.order().map((el) => el.textContent)).toEqual(['0', '1', '2']) // unchanged
    r.dispose()
  })

  it('does not reorder when the drag stays within its own slot', () => {
    const { container, items, scheduler } = setup(3)
    const events: number[] = []
    const r = reorder(container, { scheduler, onReorder: () => events.push(1) })
    pointer(items[1]!, 'pointerdown', 60)
    pointer(items[1]!, 'pointermove', 70) // small move, still over its own slot
    pointer(items[1]!, 'pointerup', 70)
    expect(events).toHaveLength(0)
    expect(r.order().map((el) => el.textContent)).toEqual(['0', '1', '2'])
    r.dispose()
  })
})
