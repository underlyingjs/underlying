import { describe, expect, it, vi } from 'vitest'
import { createManualDriver } from './manual-driver'
import { MAX_FRAME_DELTA_MS, createScheduler, type FrameInfo } from './scheduler'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  return { driver, scheduler }
}

describe('createScheduler', () => {
  it('schedules nothing while idle', () => {
    const { driver } = setup()
    expect(driver.pendingCount()).toBe(0)
    expect(driver.scheduleCalls()).toBe(0)
  })

  it('starts the loop on first subscribe and reports running state', () => {
    const { driver, scheduler } = setup()
    expect(scheduler.isRunning()).toBe(false)

    scheduler.subscribe(() => {})
    expect(scheduler.isRunning()).toBe(true)
    expect(driver.pendingCount()).toBe(1)
  })

  it('reports a zero delta on the very first frame', () => {
    const { driver, scheduler } = setup()
    const frames: FrameInfo[] = []
    scheduler.subscribe((frame) => frames.push(frame))

    driver.frame(1234)
    expect(frames).toEqual([{ deltaMs: 0, timestampMs: 1234 }])
  })

  it('computes deltas from successive driver timestamps', () => {
    const { driver, scheduler } = setup()
    const deltas: number[] = []
    scheduler.subscribe(({ deltaMs }) => deltas.push(deltaMs))

    driver.frame(0)
    driver.frame(16)
    driver.frame(41)
    expect(deltas).toEqual([0, 16, 25])
  })

  it(`clamps the frame delta to ${MAX_FRAME_DELTA_MS} ms`, () => {
    const { driver, scheduler } = setup()
    const deltas: number[] = []
    scheduler.subscribe(({ deltaMs }) => deltas.push(deltaMs))

    driver.frame(0)
    driver.frame(5000)
    expect(deltas).toEqual([0, MAX_FRAME_DELTA_MS])
  })

  it('drives N subscribers from a single driver schedule per frame', () => {
    const { driver, scheduler } = setup()
    const a = vi.fn()
    const b = vi.fn()
    const c = vi.fn()
    scheduler.subscribe(a)
    scheduler.subscribe(b)
    scheduler.subscribe(c)

    expect(driver.scheduleCalls()).toBe(1)

    driver.frame(0)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(c).toHaveBeenCalledTimes(1)
    expect(driver.scheduleCalls()).toBe(2)
  })

  it('stops the loop and cancels the pending frame when the last subscriber leaves', () => {
    const { driver, scheduler } = setup()
    const unsubscribe = scheduler.subscribe(() => {})
    expect(driver.pendingCount()).toBe(1)

    unsubscribe()
    expect(scheduler.isRunning()).toBe(false)
    expect(driver.pendingCount()).toBe(0)
  })

  it('stops the loop at the end of a tick if every subscriber left during it', () => {
    const { driver, scheduler } = setup()
    const unsubscribe = scheduler.subscribe(() => unsubscribe())

    driver.frame(0)
    expect(scheduler.isRunning()).toBe(false)
    expect(driver.pendingCount()).toBe(0)
  })

  it('does not leak a giant delta across an idle period', () => {
    const { driver, scheduler } = setup()
    const deltas: number[] = []
    const unsubscribe = scheduler.subscribe(({ deltaMs }) => deltas.push(deltaMs))
    driver.frame(0)
    driver.frame(16)
    unsubscribe()

    scheduler.subscribe(({ deltaMs }) => deltas.push(deltaMs))
    driver.frame(60_000)
    driver.frame(60_016)
    expect(deltas).toEqual([0, 16, 0, 16])
  })

  it('applies a subscription made during a tick from the next frame only', () => {
    const { driver, scheduler } = setup()
    const late = vi.fn()
    let subscribed = false
    scheduler.subscribe(() => {
      if (!subscribed) {
        subscribed = true
        scheduler.subscribe(late)
      }
    })

    driver.frame(0)
    expect(late).not.toHaveBeenCalled()
    expect(driver.pendingCount()).toBe(1)

    driver.frame(16)
    expect(late).toHaveBeenCalledTimes(1)
  })

  it('does not call a callback removed earlier in the same tick', () => {
    const { driver, scheduler } = setup()
    const removed = vi.fn()
    let unsubscribeRemoved: () => void = () => {}
    scheduler.subscribe(() => unsubscribeRemoved())
    unsubscribeRemoved = scheduler.subscribe(removed)

    driver.frame(0)
    expect(removed).not.toHaveBeenCalled()
  })

  it('runs render callbacks after update callbacks within the same tick', () => {
    const { driver, scheduler } = setup()
    const order: string[] = []
    scheduler.subscribe(() => order.push('render'), 'render')
    scheduler.subscribe(() => order.push('update'))

    driver.frame(0)
    expect(order).toEqual(['update', 'render'])
  })

  it('a render subscription made during the update phase runs in the same tick', () => {
    const { driver, scheduler } = setup()
    const order: string[] = []
    scheduler.subscribe(() => {
      order.push('update')
      const unsubscribe = scheduler.subscribe(() => {
        order.push('render')
        unsubscribe()
      }, 'render')
    })

    driver.frame(0)
    expect(order).toEqual(['update', 'render'])
    driver.frame(16)
    expect(order).toEqual(['update', 'render', 'update', 'render'])
  })

  it('a render-only subscriber keeps the loop alive until it leaves', () => {
    const { driver, scheduler } = setup()
    const unsubscribe = scheduler.subscribe(() => {}, 'render')
    expect(scheduler.isRunning()).toBe(true)

    driver.frame(0)
    expect(driver.pendingCount()).toBe(1)

    unsubscribe()
    expect(scheduler.isRunning()).toBe(false)
    expect(driver.pendingCount()).toBe(0)
  })

  it('unsubscribe is idempotent', () => {
    const { driver, scheduler } = setup()
    const keep = vi.fn()
    const leave = vi.fn()
    const unsubscribe = scheduler.subscribe(leave)
    scheduler.subscribe(keep)

    unsubscribe()
    unsubscribe()
    expect(scheduler.isRunning()).toBe(true)

    driver.frame(0)
    expect(keep).toHaveBeenCalledTimes(1)
    expect(leave).not.toHaveBeenCalled()
  })
})
