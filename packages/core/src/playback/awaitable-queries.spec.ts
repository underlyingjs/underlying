import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetReducedMotion } from '../a11y/reduced-motion'
import { linear } from '../physics/easings'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { __resetWarnings } from '../value/warn'
import { playable } from './playable'
import { createSequence } from './sequence'

function setup(initial = 0) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const value = animatable(initial, { scheduler })
  return { driver, scheduler, value, pv: playable(value, { scheduler }) }
}

function pumpMs(driver: ManualDriver, from: number, toMs: number): number {
  let t = from
  for (; t <= toMs; t += 16) driver.frame(t)
  return t
}

afterEach(() => {
  __resetReducedMotion()
  __resetWarnings()
  vi.restoreAllMocks()
})

describe('awaitable handles', () => {
  it('await value.spring(...) resolves once it settles', async () => {
    const { driver, value } = setup()
    const h = value.spring(100)
    pumpMs(driver, 0, 4000)
    await h // the handle is thenable; delegates to finished
    expect(value.get()).toBeCloseTo(100, 0)
  })

  it('await animatable.to(...) resolves', async () => {
    const { driver, value } = setup()
    const h = value.to(50, { duration: 200, easing: linear })
    pumpMs(driver, 0, 400)
    await h
    expect(value.get()).toBeCloseTo(50, 0)
  })

  it('await playable(...).to(...) resolves', async () => {
    const { driver, pv } = setup()
    const h = pv.to(80, { duration: 200, easing: linear })
    pumpMs(driver, 0, 400)
    await h
    expect(h.progress()).toBe(1)
  })

  it('await sequence resolves when the chain finishes', async () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const value = animatable(0, { scheduler })
    const seq = createSequence({ scheduler }).to(value, 100, { duration: 150, easing: linear }).play()
    pumpMs(driver, 0, 400)
    await seq // Sequence is thenable too
    expect(value.get()).toBeCloseTo(100, 0)
  })
})

describe('playhead queries', () => {
  it('reports isActive while running, false once settled', () => {
    const { driver, pv } = setup()
    const h = pv.to(100, { duration: 200, easing: linear })
    driver.frame(0)
    driver.frame(16)
    expect(h.isActive()).toBe(true)
    pumpMs(driver, 32, 400)
    expect(h.isActive()).toBe(false) // settled
  })

  it('isActive is false while paused', () => {
    const { driver, pv } = setup()
    const h = pv.to(100, { duration: 400, easing: linear })
    driver.frame(0)
    driver.frame(16)
    h.pause()
    expect(h.isActive()).toBe(false)
    h.play()
    expect(h.isActive()).toBe(true)
  })

  it('advances iteration() across repeats', () => {
    const { driver, pv } = setup()
    const h = pv.to(100, { duration: 100, easing: linear, repeat: 2 }) // 3 iterations
    driver.frame(0)
    driver.frame(16)
    expect(h.iteration()).toBe(0)
    pumpMs(driver, 32, 150) // past the first boundary
    expect(h.iteration()).toBe(1)
    pumpMs(driver, 166, 250) // past the second
    expect(h.iteration()).toBe(2)
  })

  it('totalProgress() spans the whole run, not one iteration', () => {
    const { driver, pv } = setup()
    const h = pv.to(100, { duration: 100, easing: linear, repeat: 1 }) // 2 iterations, total 200ms
    pumpMs(driver, 0, 96) // ~halfway through the FIRST of two iterations
    const total = h.totalProgress()
    expect(total).toBeGreaterThan(0.35)
    expect(total).toBeLessThan(0.6) // ~0.5 of the whole run; a single-iteration progress would read ~1
  })

  it('startTime() and endTime() cover delay + all iterations', () => {
    const { pv } = setup()
    const h = pv.to(100, { duration: 100, easing: linear, delay: 50, repeat: 2, repeatDelay: 20 })
    expect(h.startTime()).toBeCloseTo(50, 0) // the initial delay
    // 3 iterations * 100 + 2 repeatDelays * 20 = 340, plus the 50 delay = 390
    expect(h.endTime()).toBeCloseTo(390, 0)
  })

  it('endTime() is undefined for an infinite repeat', () => {
    const { pv } = setup()
    const h = pv.to(100, { duration: 100, easing: linear, repeat: Infinity })
    expect(h.endTime()).toBeUndefined()
  })

  it('restart() replays from the beginning', () => {
    const { driver, pv } = setup()
    const h = pv.to(100, { duration: 200, easing: linear })
    const t = pumpMs(driver, 0, 128) // partway (continues from the returned clock)
    expect(h.progress()).toBeGreaterThan(0.4)
    h.restart()
    driver.frame(t) // ~16ms after restart
    driver.frame(t + 16)
    expect(h.progress()).toBeLessThan(0.25) // back near the start
    expect(h.iteration()).toBe(0)
  })

  it('totalProgress() still tracks the playhead after restart() skips the initial delay', () => {
    const { driver, pv } = setup()
    const h = pv.to(100, { duration: 200, easing: linear, delay: 50 })
    const t = pumpMs(driver, 0, 160) // partway (past the 50ms delay)
    h.restart()
    // Drive to just before the 200ms duration ends.
    let clock = t
    for (; clock <= t + 176; clock += 16) driver.frame(clock)
    // Without the delay-seed fix totalProgress would cap at ~0.8 while progress ~0.96.
    expect(h.totalProgress()).toBeCloseTo(h.progress(), 1)
    expect(h.totalProgress()).toBeGreaterThan(0.8)
  })

  it('restart() on a finished handle warns once and no-ops', () => {
    const { driver, pv } = setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const h = pv.to(100, { duration: 100, easing: linear })
    pumpMs(driver, 0, 300) // settle
    expect(h.isActive()).toBe(false)
    h.restart()
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
