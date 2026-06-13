import { describe, expect, it, vi } from 'vitest'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import * as springModule from '../physics/spring'
import { follow } from './follow'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  return { driver, scheduler }
}

function pumpMs(driver: ManualDriver, from: number, toMs: number): number {
  let t = from
  for (; t <= toMs; t += 16) driver.frame(t)
  return t
}

describe('follow', () => {
  it('re-aims at a moving target with no Motion rebuild after construction', () => {
    const { driver, scheduler } = setup()
    const spy = vi.spyOn(springModule, 'springSimulation')

    const f = follow(0, { scheduler })
    f.target(100)
    let t = 0
    for (let i = 1; i <= 144; i++) {
      t += 16
      driver.frame(t)
      f.target(100 + i) // a fresh target every frame
    }

    expect(spy).toHaveBeenCalledTimes(1) // built once, only retarget() afterwards
    f.dispose()
    spy.mockRestore()
  })

  it('conserves velocity across a re-aim', () => {
    const { driver, scheduler } = setup()
    const f = follow(0, { scheduler })
    f.target(100)
    pumpMs(driver, 0, 80)
    const vel = f.value.velocity()
    expect(vel).not.toBe(0)

    f.target(50)
    expect(f.value.velocity()).toBe(vel) // re-aim keeps the live velocity
    f.dispose()
  })

  it('is critically damped by default: it reaches the target without overshoot', () => {
    const { driver, scheduler } = setup()
    const f = follow(0, { scheduler })
    const samples: number[] = []
    f.value.on('change', (v) => samples.push(v))

    f.target(100)
    pumpMs(driver, 0, 5000)
    expect(f.value.get()).toBe(100)
    expect(Math.max(...samples)).toBeLessThanOrEqual(100.001) // monotonic approach
    f.dispose()
  })

  it('dispose() stops the loop and releases the subscription', () => {
    const { driver, scheduler } = setup()
    const f = follow(0, { scheduler })
    f.target(100)
    driver.frame(0)
    driver.frame(16)
    expect(driver.pendingCount()).toBeGreaterThan(0)

    f.dispose()
    expect(driver.pendingCount()).toBe(0) // loop asleep
    const before = f.value.get()
    driver.frame(32)
    expect(f.value.get()).toBe(before)
  })
})
