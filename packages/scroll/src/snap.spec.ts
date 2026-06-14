import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import type { MotionPolicy } from './a11y'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

function manualPolicy(initial = false) {
  let reduced = initial
  const policy: MotionPolicy = {
    reduced: () => reduced,
    onChange: () => () => {},
  }
  return { policy, set: (r: boolean) => (reduced = r) }
}

function setup(reduced = false) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
  const a11y = manualPolicy(reduced)
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source, policy: a11y.policy }) }
}

/** Run frames until the snap settles (or a cap). */
function settle(driver: ReturnType<typeof createManualDriver>, fromT: number) {
  for (let t = fromT; t <= fromT + 4000; t += 16) driver.frame(t)
}

describe('snap', () => {
  it('snaps to the nearest stop once the scroll goes idle', () => {
    const { driver, source, scroll } = setup()
    const snapped: number[] = []
    scroll.snap({ to: 0.5, onSnap: (p) => snapped.push(p) }) // stops at 0, 0.5, 1

    source.emitScroll(400) // p = 0.2, moving down
    driver.frame(0) // detects movement, direction = 1
    driver.frame(16) // idle 1
    driver.frame(32) // idle 2 -> startSnap toward 0.5
    settle(driver, 48)

    expect(source.scrollPos()).toBeCloseTo(1000, 0) // 0.5 * maxScroll
    expect(snapped.at(-1)).toBeCloseTo(0.5)
  })

  it('directional snap only moves in the travel direction', () => {
    const { driver, source, scroll } = setup()
    scroll.snap({ to: 0.5 }) // directional default true

    source.emitScroll(400) // p = 0.2, scrolling DOWN
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    settle(driver, 48)

    expect(source.scrollPos()).toBeCloseTo(1000, 0) // snapped UP to 0.5, not back to 0
  })

  it('accepts a custom resolver', () => {
    const { driver, source, scroll } = setup()
    scroll.snap({ to: () => 0.25 }) // always snap to a quarter

    source.emitScroll(900)
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    settle(driver, 48)

    expect(source.scrollPos()).toBeCloseTo(500, 0) // 0.25 * 2000
  })

  it('reduced motion snaps instantly', () => {
    const { driver, source, scroll } = setup(true)
    const snapped: number[] = []
    scroll.snap({ to: 0.5, onSnap: (p) => snapped.push(p) })

    source.emitScroll(400)
    driver.frame(0)
    driver.frame(16)
    driver.frame(32) // idle -> instant scrollTo, no spring

    expect(source.scrollPos()).toBe(1000)
    expect(snapped).toEqual([0.5])
  })

  it('dispose() stops snapping', () => {
    const { driver, source, scroll } = setup()
    const snap = scroll.snap({ to: 0.5 })

    source.emitScroll(400)
    driver.frame(0)
    snap.dispose()
    driver.frame(16)
    driver.frame(32)
    settle(driver, 48)

    expect(source.scrollPos()).toBe(400) // never snapped
  })

  it('keeps snapping across repeated scrolls (not stuck after the first)', () => {
    const { driver, source, scroll } = setup() // viewport 1000, maxScroll 2000
    scroll.snap({ to: 0.5 }) // stops at 0, 0.5, 1

    const burst = (pos: number, t: number): void => {
      source.emitScroll(pos)
      driver.frame(t)
      driver.frame(t + 16)
      driver.frame(t + 32)
      settle(driver, t + 48)
    }

    burst(400, 0) // down to 0.2 -> directional up to 0.5
    expect(source.scrollPos()).toBeCloseTo(1000, 0)

    burst(1200, 5000) // down to 0.6 -> directional up to 1.0
    expect(source.scrollPos()).toBeCloseTo(2000, 0)

    burst(1400, 10000) // up to 0.7 -> directional down to 0.5
    expect(source.scrollPos()).toBeCloseTo(1000, 0)
  })
})
