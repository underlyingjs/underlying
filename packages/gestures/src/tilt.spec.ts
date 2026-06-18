// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { tilt } from './tilt'

// jsdom returns a zero rect by default; pin one so the pointer math is real.
const setRect = (el: HTMLElement, r: { left: number; top: number; width: number; height: number }): void => {
  el.getBoundingClientRect = () =>
    ({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.left + r.width,
      bottom: r.top + r.height,
      x: r.left,
      y: r.top,
      toJSON() {},
    }) as DOMRect
}
const ptr = (type: string, clientX: number, clientY: number): MouseEvent =>
  new MouseEvent(type, { clientX, clientY, bubbles: true })

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('div')
  setRect(el, { left: 0, top: 0, width: 200, height: 100 })
  return { driver, scheduler, el }
}
const settle = (driver: ReturnType<typeof createManualDriver>): void => {
  for (let t = 0; t <= 1200; t += 16) driver.frame(t)
}

afterEach(() => setReducedMotionOverride(null))

describe('tilt', () => {
  it('tilts toward the cursor and settles at the edge value', () => {
    const { driver, scheduler, el } = setup()
    const t = tilt(el, { max: 12, scheduler })
    el.dispatchEvent(ptr('pointermove', 200, 50)) // right edge, vertical center
    settle(driver)
    expect(t.rotateY.get()).toBeCloseTo(12, 0) // horizontal edge -> +max
    expect(t.rotateX.get()).toBeCloseTo(0, 1) // vertically centered -> no x tilt
    t.dispose()
  })

  it('springs flat on pointerleave', () => {
    const { driver, scheduler, el } = setup()
    const t = tilt(el, { max: 12, scheduler })
    el.dispatchEvent(ptr('pointermove', 200, 100)) // bottom-right corner
    settle(driver)
    expect(Math.abs(t.rotateX.get())).toBeGreaterThan(1)
    expect(Math.abs(t.rotateY.get())).toBeGreaterThan(1)

    el.dispatchEvent(ptr('pointerleave', 0, 0))
    settle(driver)
    expect(t.rotateX.get()).toBeCloseTo(0, 1)
    expect(t.rotateY.get()).toBeCloseTo(0, 1)
    t.dispose()
  })

  it('reverse tilts away from the cursor', () => {
    const { driver, scheduler, el } = setup()
    const t = tilt(el, { max: 12, reverse: true, scheduler })
    el.dispatchEvent(ptr('pointermove', 200, 50)) // right edge
    settle(driver)
    expect(t.rotateY.get()).toBeCloseTo(-12, 0) // opposite sign
    t.dispose()
  })

  it('holds flat under reduced motion', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, el } = setup()
    const t = tilt(el, { max: 12, scheduler })
    el.dispatchEvent(ptr('pointermove', 200, 50))
    settle(driver)
    expect(t.rotateY.get()).toBeCloseTo(0, 1) // no tilt
    t.dispose()
  })

  it('dispose() stops responding', () => {
    const { driver, scheduler, el } = setup()
    const t = tilt(el, { max: 12, scheduler })
    el.dispatchEvent(ptr('pointermove', 200, 50))
    settle(driver)
    const before = t.rotateY.get()

    t.dispose()
    el.dispatchEvent(ptr('pointermove', 0, 0)) // listener gone
    settle(driver)
    expect(t.rotateY.get()).toBe(before) // frozen
  })
})
