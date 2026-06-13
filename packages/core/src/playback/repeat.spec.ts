import { afterEach, describe, expect, it } from 'vitest'
import { __resetReducedMotion, setReducedMotionOverride } from '../a11y/reduced-motion'
import { linear } from '../physics/easings'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { __resetWarnings } from '../value/warn'
import { playable } from './playable'

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
})

describe('repeat / delay / yoyo', () => {
  it('a repeating spring resets to its launch (velocity 0) between iterations', () => {
    const { driver, value, pv } = setup(0)
    const samples: number[] = []
    value.on('change', (v) => samples.push(v))
    pv.spring(100, { repeat: 1 }) // two iterations, both 0 -> 100

    pumpMs(driver, 0, 8000)
    expect(value.get()).toBe(100) // last iteration settles on target

    const top = samples.findIndex((v) => v >= 99)
    expect(top).toBeGreaterThan(-1)
    expect(Math.min(...samples.slice(top))).toBeLessThan(5) // dropped back to launch for iteration 2
  })

  it('a yoyo tween mirrors the curve and lands back at the start', () => {
    const { driver, value, pv } = setup(0)
    const samples: number[] = []
    value.on('change', (v) => samples.push(v))
    pv.to(100, { duration: 320, easing: linear, repeat: 1, yoyo: true })

    pumpMs(driver, 0, 2000)
    expect(Math.max(...samples)).toBeCloseTo(100, 0) // reached the far end
    expect(value.get()).toBeCloseTo(0, 6) // then mirrored home
  })

  it('repeat: Infinity never resolves finished, but stop() does', async () => {
    const { driver, pv } = setup(0)
    const h = pv.to(100, { duration: 200, easing: linear, repeat: Infinity })
    let resolved = false
    void h.finished.then(() => {
      resolved = true
    })

    pumpMs(driver, 0, 3000) // many iterations
    await Promise.resolve()
    expect(resolved).toBe(false)

    h.stop()
    await h.finished // resolves, does not hang
  })

  it('honors an initial delay before the first iteration', () => {
    const { driver, value, pv } = setup(0)
    pv.to(100, { duration: 200, easing: linear, delay: 320 })

    pumpMs(driver, 0, 300) // still inside the 320 ms delay
    expect(value.get()).toBe(0) // untouched

    pumpMs(driver, 316, 1000)
    expect(value.get()).toBe(100) // ran after the delay
  })

  it('pause() freezes the whole clock, repeatDelay included (one clock, one pause)', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.to(100, { duration: 200, easing: linear, repeat: 3, repeatDelay: 500 })

    pumpMs(driver, 0, 400) // somewhere in iteration 1 or its repeatDelay
    h.pause()
    const frozenTotal = h.totalTime()
    const frozenPos = value.get()

    pumpMs(driver, 416, 2000)
    expect(h.totalTime()).toBe(frozenTotal) // clock did not advance
    expect(value.get()).toBe(frozenPos)
  })

  it('collapses to the yoyo-correct final waypoint under reduced motion', () => {
    setReducedMotionOverride(true)
    const even = setup(0)
    even.pv.to(100, { duration: 300, repeat: 3, yoyo: true }) // 4 legs, ends at start
    expect(even.value.get()).toBe(0)

    const odd = setup(0)
    odd.pv.to(100, { duration: 300, repeat: 2, yoyo: true }) // 3 legs, ends at target
    expect(odd.value.get()).toBe(100)

    const plain = setup(0)
    plain.pv.spring(100, { repeat: 5 }) // non-yoyo, always the target
    expect(plain.value.get()).toBe(100)
  })
})
