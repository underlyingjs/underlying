// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { depth } from './depth'

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
  const layer = document.createElement('div')
  const frame = document.createElement('div')
  setRect(frame, { left: 0, top: 0, width: 200, height: 100 }) // centre (100, 50), half (100, 50)
  return { driver, scheduler, layer, frame }
}
const settle = (driver: ReturnType<typeof createManualDriver>): void => {
  for (let t = 0; t <= 1400; t += 16) driver.frame(t)
}

afterEach(() => setReducedMotionOverride(null))

describe('depth', () => {
  it('drifts the layer against the pointer, scaled by shift', () => {
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, scheduler })
    movePointer(150, 50) // nx = (150-100)/100 = 0.5 -> -0.5 * 40 = -20
    settle(driver)
    expect(d.x.get()).toBeCloseTo(-20, 0)
    expect(d.y.get()).toBeCloseTo(0, 1)
    d.dispose()
  })

  it('invert moves the layer with the pointer', () => {
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, invert: true, scheduler })
    movePointer(150, 50) // 0.5 * 40 = +20
    settle(driver)
    expect(d.x.get()).toBeCloseTo(20, 0)
    d.dispose()
  })

  it('clamps travel to +/-shift past the frame edge', () => {
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, scheduler }) // clamp defaults true
    movePointer(1000, 50) // nx = 9, clamped to 1 -> -40, not -360
    settle(driver)
    expect(d.x.get()).toBeCloseTo(-40, 0)
    d.dispose()
  })

  it('clamp: false lets travel grow past the edge', () => {
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, clamp: false, scheduler })
    movePointer(300, 50) // nx = 2 -> -80
    settle(driver)
    expect(d.x.get()).toBeCloseTo(-80, 0)
    d.dispose()
  })

  it('axis: x pins the y channel to a constant 0', () => {
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, axis: 'x', scheduler })
    movePointer(150, 100) // moves in both axes; only x should travel
    settle(driver)
    expect(d.x.get()).toBeCloseTo(-20, 0)
    expect(d.y.get()).toBe(0) // constant, never a live spring
    d.dispose()
  })

  it('holds flat under reduced motion', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, scheduler })
    movePointer(150, 50)
    settle(driver)
    expect(d.x.get()).toBeCloseTo(0, 1)
    d.dispose()
  })

  it('skips a zero-size viewport instead of poisoning the spring with NaN', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const layer = document.createElement('div')
    const ow = window.innerWidth
    const oh = window.innerHeight
    Object.defineProperty(window, 'innerWidth', { value: 0, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 0, configurable: true })

    const d = depth(layer, { shift: 40, scheduler }) // frame defaults to 'viewport'
    movePointer(10, 10)
    settle(driver)
    expect(Number.isNaN(d.x.get())).toBe(false)
    expect(d.x.get()).toBe(0)

    // a restored viewport drives cleanly - the bad frame left no poison behind
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    movePointer(1000, 400) // nx = (1000-500)/500 = 1 -> -40
    settle(driver)
    expect(d.x.get()).toBeCloseTo(-40, 0)

    Object.defineProperty(window, 'innerWidth', { value: ow, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: oh, configurable: true })
    d.dispose()
  })

  it('resumes from the last pointer when reduced motion turns back off', () => {
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, scheduler })
    movePointer(150, 50) // targets -20
    settle(driver)
    expect(d.x.get()).toBeCloseTo(-20, 0)

    setReducedMotionOverride(true) // homes flat
    settle(driver)
    expect(d.x.get()).toBeCloseTo(0, 1)

    setReducedMotionOverride(false) // resumes from the known pointer, no new move
    settle(driver)
    expect(d.x.get()).toBeCloseTo(-20, 0)
    d.dispose()
  })

  it('dispose() unsubscribes from the pointer', () => {
    const { driver, scheduler, layer, frame } = setup()
    const d = depth(layer, { frame, shift: 40, scheduler })
    movePointer(150, 50)
    settle(driver)
    const before = d.x.get()

    d.dispose()
    movePointer(190, 50) // would drift further, but we are unsubscribed
    settle(driver)
    expect(d.x.get()).toBe(before) // frozen
  })
})
