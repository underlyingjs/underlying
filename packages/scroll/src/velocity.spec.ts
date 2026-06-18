import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import type { MotionPolicy } from './a11y'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

/** A deterministic reduced-motion policy, toggled by the test. */
function manualPolicy(initial = false): { policy: MotionPolicy; set: (v: boolean) => void } {
  let reduced = initial
  const listeners = new Set<(r: boolean) => void>()
  return {
    policy: {
      reduced: () => reduced,
      onChange: (l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      },
    },
    set: (v) => {
      if (v === reduced) return
      reduced = v
      for (const l of [...listeners]) l(v)
    },
  }
}

function setup(policy?: MotionPolicy) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 50000 })
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source, ...(policy ? { policy } : {}) }) }
}

describe('velocity', () => {
  it('rests at map(0) at creation', () => {
    const { scroll } = setup()
    expect(scroll.velocity().get()).toBe(0)
  })

  it('ramps up with scroll speed and relaxes to rest when it stops', () => {
    const { driver, source, scroll } = setup()
    const vel = scroll.velocity({ smooth: 0.05 })

    source.emitScroll(100)
    driver.frame(0) // baseline frame establishes lastPos
    source.emitScroll(500)
    driver.frame(16) // +400px in 16ms -> +25000 px/s
    source.emitScroll(900)
    driver.frame(32)
    expect(vel.get()).toBeGreaterThan(0) // leaning in the scroll direction

    // stop scrolling: raw -> 0, the spring relaxes back to rest
    for (let t = 48; t <= 2000; t += 16) driver.frame(t)
    expect(vel.get()).toBeCloseTo(0, 1)
  })

  it('is signed: scrolling back reads the opposite sign', () => {
    const { driver, source, scroll } = setup()
    const vel = scroll.velocity({ smooth: 0.05 })
    source.emitScroll(2000)
    driver.frame(0)
    source.emitScroll(1000)
    driver.frame(16) // -1000px -> negative velocity
    source.emitScroll(200)
    driver.frame(32)
    expect(vel.get()).toBeLessThan(0)
  })

  it('maps raw px/s through `map` (clamped to a degree range, never overshoots)', () => {
    const { driver, source, scroll } = setup()
    const vel = scroll.velocity({ smooth: 0.05, map: (v) => Math.max(-6, Math.min(6, v * 0.01)) })
    source.emitScroll(100)
    driver.frame(0)
    for (let i = 1; i <= 8; i++) {
      source.emitScroll(100 + i * 600) // fast continuous scroll, well past the clamp
      driver.frame(i * 16)
    }
    const v = vel.get()
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThanOrEqual(6) // clamped at the map; critically-damped follow does not overshoot
  })

  it('holds at rest under reduced motion', () => {
    const a11y = manualPolicy(true)
    const { driver, source, scroll } = setup(a11y.policy)
    const vel = scroll.velocity()
    source.emitScroll(500)
    driver.frame(0)
    source.emitScroll(1500)
    driver.frame(16)
    expect(vel.get()).toBe(0) // no lean when reduced motion is on
  })

  it('dispose() stops sampling', () => {
    const { driver, source, scroll } = setup()
    const vel = scroll.velocity({ smooth: 0.05 })
    source.emitScroll(100)
    driver.frame(0)
    source.emitScroll(500)
    driver.frame(16)
    const before = vel.get()

    vel.dispose()
    source.emitScroll(5000)
    driver.frame(32)
    expect(vel.get()).toBe(before) // frozen, no further movement
  })
})
