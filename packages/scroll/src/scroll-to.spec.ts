import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import type { MotionPolicy } from './a11y'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

function manualPolicy(initial = false) {
  let reduced = initial
  const policy: MotionPolicy = { reduced: () => reduced, onChange: () => () => {} }
  return { policy, set: (r: boolean) => (reduced = r) }
}

function setup(reduced = false) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
  const a11y = manualPolicy(reduced)
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source, policy: a11y.policy }) }
}

/** Run frames until the spring settles (or a generous cap). */
function settle(driver: ReturnType<typeof createManualDriver>, fromT = 0): void {
  for (let t = fromT; t <= fromT + 6000; t += 16) driver.frame(t)
}

describe('scrollTo', () => {
  it('springs the scroller to an absolute position', () => {
    const { driver, source, scroll } = setup()
    scroll.scrollTo(1000)
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(1000, 0)
  })

  it('brings an element into view (default align: start to start)', () => {
    const { driver, source, scroll } = setup()
    const el = {} as HTMLElement
    source.setBox(el, { start: 1500, size: 200 })
    scroll.scrollTo(el)
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(1500, 0) // element's start edge at the viewport's start
  })

  it('offset nudges the landing (e.g. clearing a sticky header)', () => {
    const { driver, source, scroll } = setup()
    const el = {} as HTMLElement
    source.setBox(el, { start: 1500, size: 200 })
    scroll.scrollTo(el, { offset: -80 })
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(1420, 0)
  })

  it('never aims past the reachable range', () => {
    const { driver, source, scroll } = setup() // maxScroll 2000
    scroll.scrollTo(5000)
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(2000, 0)
  })

  it('reduced motion jumps instantly, no spring', () => {
    const { source, scroll } = setup(true)
    let arrived = false
    scroll.scrollTo(1234, { onArrive: () => (arrived = true) })
    expect(source.scrollPos()).toBe(1234) // landed without any frame
    expect(arrived).toBe(true)
  })

  it('immediate jumps instantly', () => {
    const { source, scroll } = setup()
    scroll.scrollTo(800, { immediate: true })
    expect(source.scrollPos()).toBe(800)
  })

  it('already on target settles without moving', () => {
    const { source, scroll } = setup()
    let arrived = false
    scroll.scrollTo(0, { onArrive: () => (arrived = true) })
    expect(arrived).toBe(true)
    expect(source.scrollPos()).toBe(0)
  })

  it('cancel() freezes the scroller mid-flight', () => {
    const { driver, source, scroll } = setup()
    const handle = scroll.scrollTo(1000)
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    const mid = source.scrollPos()
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1000)
    handle.cancel()
    settle(driver, 48)
    expect(source.scrollPos()).toBe(mid) // never moved again
  })

  it('a second scrollTo re-aims and cancels the first', () => {
    const { driver, source, scroll } = setup()
    let firstArrived = 0
    scroll.scrollTo(1000, { onArrive: () => (firstArrived += 1) })
    driver.frame(0)
    driver.frame(16)
    scroll.scrollTo(2000) // cancels the first in-flight scroll
    expect(firstArrived).toBe(1) // the first handle resolved on cancel
    settle(driver, 32)
    expect(source.scrollPos()).toBeCloseTo(2000, 0)
  })

  it('a mid-flight re-aim conserves momentum (carries past a behind-target)', () => {
    const { driver, source, scroll } = setup()
    scroll.scrollTo(2000, { spring: { stiffness: 140 } }) // build forward speed toward the end
    for (let t = 0; t <= 200; t += 16) driver.frame(t)
    const p = source.scrollPos()
    expect(p).toBeGreaterThan(0)
    expect(p).toBeLessThan(2000) // still mid-flight, moving forward

    scroll.scrollTo(p / 2) // re-aim BEHIND: a fresh-from-rest spring would head straight back
    let maxPos = source.scrollPos()
    for (let t = 216; t <= 7000; t += 16) {
      driver.frame(t)
      maxPos = Math.max(maxPos, source.scrollPos())
    }
    expect(maxPos).toBeGreaterThan(p) // momentum carried it forward past the re-aim point
    expect(source.scrollPos()).toBeCloseTo(p / 2, 0) // then settled on the new target
  })

  it('finished resolves on arrival', async () => {
    const { driver, scroll } = setup()
    const handle = scroll.scrollTo(1000)
    settle(driver)
    await expect(handle.finished).resolves.toBeUndefined()
  })

  it('dispose() cancels an in-flight scroll', () => {
    const { driver, source, scroll } = setup()
    scroll.scrollTo(1000)
    driver.frame(0)
    driver.frame(16)
    const mid = source.scrollPos()
    scroll.dispose()
    settle(driver, 32)
    expect(source.scrollPos()).toBe(mid)
  })
})
