// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { magnetic } from './magnetic'

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
const movePointer = (x: number, y: number): void => {
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
}

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('div')
  setRect(el, { left: 100, top: 100, width: 100, height: 100 }) // centre (150, 150)
  return { driver, scheduler, el }
}
const settle = (driver: ReturnType<typeof createManualDriver>): void => {
  for (let t = 0; t <= 1400; t += 16) driver.frame(t)
}

afterEach(() => setReducedMotionOverride(null))

describe('magnetic', () => {
  it('pulls a fraction of the cursor offset within the radius', () => {
    const { driver, scheduler, el } = setup()
    const m = magnetic(el, { strength: 0.3, radius: 200, scheduler })
    movePointer(200, 150) // 50px right of centre -> 50 * 0.3 = 15
    settle(driver)
    expect(m.x.get()).toBeCloseTo(15, 0)
    expect(m.y.get()).toBeCloseTo(0, 1)
    m.dispose()
  })

  it('springs home when the cursor leaves the radius', () => {
    const { driver, scheduler, el } = setup()
    const m = magnetic(el, { strength: 0.3, radius: 100, scheduler })
    movePointer(190, 150) // 40px offset, inside radius 100 -> pulled
    settle(driver)
    expect(Math.abs(m.x.get())).toBeGreaterThan(1)

    movePointer(600, 600) // far beyond the radius
    settle(driver)
    expect(m.x.get()).toBeCloseTo(0, 1)
    expect(m.y.get()).toBeCloseTo(0, 1)
    m.dispose()
  })

  it('holds home under reduced motion', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, el } = setup()
    const m = magnetic(el, { strength: 0.3, radius: 300, scheduler })
    movePointer(200, 150)
    settle(driver)
    expect(m.x.get()).toBeCloseTo(0, 1) // no pull
    m.dispose()
  })

  it('dispose() unsubscribes from the pointer', () => {
    const { driver, scheduler, el } = setup()
    const m = magnetic(el, { strength: 0.3, radius: 300, scheduler })
    movePointer(200, 150)
    settle(driver)
    const before = m.x.get()

    m.dispose()
    movePointer(260, 150) // would pull further, but we are unsubscribed
    settle(driver)
    expect(m.x.get()).toBe(before) // frozen
  })
})
