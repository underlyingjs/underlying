import { describe, expect, it } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { waitFrames } from './wait'

describe('waitFrames', () => {
  it('fires onDone after the delay has elapsed on the frame clock', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    let fired = false
    waitFrames(50, scheduler, () => (fired = true))
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    expect(fired).toBe(false) // 32ms < 50ms
    driver.frame(48)
    driver.frame(64)
    expect(fired).toBe(true) // crossed 50ms
  })

  it('the returned unsubscribe cancels a pending wait', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    let fired = false
    const cancel = waitFrames(50, scheduler, () => (fired = true))
    driver.frame(0)
    cancel()
    for (let t = 16; t <= 200; t += 16) driver.frame(t)
    expect(fired).toBe(false)
  })
})
