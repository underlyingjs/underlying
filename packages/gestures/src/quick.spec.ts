// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { quickTo } from './quick'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('div')
  return { driver, scheduler, el }
}
const settle = (driver: ReturnType<typeof createManualDriver>): void => {
  for (let t = 0; t <= 1400; t += 16) driver.frame(t)
}

afterEach(() => setReducedMotionOverride(null))

describe('quickTo', () => {
  it('springs a single channel toward the target', () => {
    const { driver, scheduler, el } = setup()
    const x = quickTo(el, 'x', { scheduler })
    x(120)
    settle(driver)
    expect(x.value.get()).toBeCloseTo(120, 0)
    x.dispose()
  })

  it('drives two channels through one bindStyle (no clobber)', () => {
    const { driver, scheduler, el } = setup()
    const move = quickTo(el, ['x', 'y'], { scheduler })
    move(30, 40)
    settle(driver)
    expect(move.values[0].get()).toBeCloseTo(30, 0)
    expect(move.values[1].get()).toBeCloseTo(40, 0)
    // one combined transform write keeps both axes
    expect(el.style.transform).toBe('translate3d(30px, 40px, 0)')
    move.dispose()
  })

  it('seeds the value from `from`', () => {
    const { scheduler, el } = setup()
    const scale = quickTo(el, 'scale', { from: 1, scheduler })
    expect(scale.value.get()).toBe(1)
    scale.dispose()
  })

  it('snaps to the target under reduced motion instead of springing', () => {
    setReducedMotionOverride(true)
    const { scheduler, el } = setup()
    const x = quickTo(el, 'x', { scheduler })
    x(200)
    // no frames stepped: the value is already there, no motion
    expect(x.value.get()).toBe(200)
    x.dispose()
  })

  it('snaps under reduced motion without animating through intermediate frames', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, el } = setup()
    const x = quickTo(el, 'x', { scheduler })
    x(200)
    driver.frame(0)
    driver.frame(16) // stepping frames must not start an animation from 0
    expect(x.value.get()).toBe(200)
    x.dispose()
  })

  it('retargets correctly after reduced motion turns back off', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, el } = setup()
    const x = quickTo(el, 'x', { scheduler }) // from 0
    x(300) // snaps to 300; the spring's aim must stay in sync
    expect(x.value.get()).toBe(300)

    setReducedMotionOverride(false)
    x(0) // back to the origin - must not be dropped as a stale no-op
    settle(driver)
    expect(x.value.get()).toBeCloseTo(0, 0)
    x.dispose()
  })

  it('rejects a pair of the same channel', () => {
    const { el } = setup()
    expect(() => quickTo(el, ['x', 'x'])).toThrow()
  })

  it('snaps an in-flight spring when reduced motion turns on', () => {
    const { driver, scheduler, el } = setup()
    const x = quickTo(el, 'x', { scheduler })
    x(200)
    driver.frame(0)
    driver.frame(16) // a couple of frames: mid-spring, not yet at 200
    expect(x.value.get()).toBeLessThan(200)

    setReducedMotionOverride(true) // snaps to the last target now
    expect(x.value.get()).toBe(200)
    x.dispose()
  })

  it('dispose() unbinds and freezes the value', () => {
    const { driver, scheduler, el } = setup()
    const x = quickTo(el, 'x', { scheduler })
    x(120)
    settle(driver)
    const before = x.value.get()

    x.dispose()
    x(300) // a stray call after teardown must not move it
    settle(driver)
    expect(x.value.get()).toBe(before)
  })
})
