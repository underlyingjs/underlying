import { describe, expect, it } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler, type FrameInfo } from '../scheduler/scheduler'
import { timeScope, type TimeScopeOptions } from './time-scope'

function setup(options: Omit<TimeScopeOptions, 'scheduler'> = {}) {
  const driver = createManualDriver()
  const parent = createScheduler(driver)
  const scope = timeScope({ scheduler: parent, ...options })
  return { driver, parent, scope }
}

describe('timeScope', () => {
  it('subscribes the parent once and fans one shared frame to every member', () => {
    const { driver, scope } = setup()
    const seenA: FrameInfo[] = []
    const seenB: FrameInfo[] = []
    scope.subscribe((f) => seenA.push(f))
    scope.subscribe((f) => seenB.push(f))

    driver.frame(0)
    driver.frame(16)

    // One initial schedule plus one per frame, independent of member count.
    expect(driver.scheduleCalls()).toBe(3)
    expect(seenA[1]).toBe(seenB[1]) // the exact same FrameInfo object
  })

  it('scales the delta members see by the time scale', () => {
    const { driver, scope } = setup({ timeScale: 0.5 })
    const seen: number[] = []
    scope.subscribe((f) => seen.push(f.deltaMs))

    driver.frame(0) // delta 0
    driver.frame(16) // delta 16 -> 8
    driver.frame(32) // delta 16 -> 8
    expect(seen).toEqual([0, 8, 8])
  })

  it('re-clamps after scaling so a scale-up cannot exceed the freeze guard', () => {
    const { driver, scope } = setup({ timeScale: 10 })
    const seen: number[] = []
    scope.subscribe((f) => seen.push(f.deltaMs))

    driver.frame(0)
    driver.frame(16) // 160 scaled, clamped to MAX_FRAME_DELTA_MS (64)
    expect(seen.at(-1)).toBe(64)
  })

  it('pause() drops the parent subscription so the loop sleeps; resume() re-attaches', () => {
    const { driver, scope } = setup()
    const seen: number[] = []
    scope.subscribe((f) => seen.push(f.deltaMs))
    driver.frame(0)
    driver.frame(16)
    const beforePause = seen.length

    scope.pause()
    expect(scope.isPaused()).toBe(true)
    expect(driver.pendingCount()).toBe(0) // loop asleep
    driver.frame(32)
    expect(seen.length).toBe(beforePause)

    scope.resume()
    expect(scope.isPaused()).toBe(false)
    driver.frame(48)
    driver.frame(64)
    expect(seen.length).toBeGreaterThan(beforePause)
  })

  it('timeScale(0) stops integration but keeps the loop alive (unlike pause)', () => {
    const { driver, scope } = setup()
    const seen: number[] = []
    scope.subscribe((f) => seen.push(f.deltaMs))
    scope.setTimeScale(0)
    driver.frame(0)
    driver.frame(16)
    expect(scope.isRunning()).toBe(true)
    expect(driver.pendingCount()).toBeGreaterThan(0)
    expect(seen).toEqual([0, 0]) // zero delta, but still ticked
  })

  it('unsubscribing the last member detaches from the parent', () => {
    const { driver, scope } = setup()
    const unsub = scope.subscribe(() => {})
    expect(driver.pendingCount()).toBe(1)
    unsub()
    expect(driver.pendingCount()).toBe(0)
    expect(scope.isRunning()).toBe(false)
  })
})
