// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animate } from './animate'

type Driver = ReturnType<typeof createManualDriver>
function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const element = document.createElement('div')
  return { driver, scheduler, element }
}
const settle = (driver: Driver): void => {
  for (let t = 0; t <= 4000; t += 16) driver.frame(t)
}

describe('animate() lifecycle callbacks', () => {
  it('fires onStart synchronously and onComplete at settle', async () => {
    const { driver, scheduler, element } = setup()
    const events: string[] = []
    const h = animate(
      element,
      { x: 100, opacity: 0 },
      { scheduler, onStart: () => events.push('start'), onComplete: () => events.push('complete') },
    )
    expect(events).toEqual(['start']) // synchronous
    settle(driver)
    await h.finished // onComplete is tied to the finished promise
    expect(events).toEqual(['start', 'complete'])
  })

  it('onUpdate receives the live values object each frame', () => {
    const { driver, scheduler, element } = setup()
    const frames: Array<Record<string, number>> = []
    animate(element, { x: 100, opacity: 0 }, { scheduler, onUpdate: (values) => frames.push({ ...values }) })
    settle(driver)
    expect(frames.length).toBeGreaterThan(2)
    const last = frames[frames.length - 1] as Record<string, number>
    expect(last.x).toBeCloseTo(100, 0)
    expect(last.opacity).toBeCloseTo(0, 1)
  })

  it('onUpdate forces the JS path (no WAAPI delegation)', () => {
    const { scheduler, element } = setup()
    let delegated = false
    // jsdom has no element.animate; defining it lets us detect a delegation attempt.
    ;(element as unknown as { animate: () => void }).animate = () => {
      delegated = true
    }
    animate(element, { x: 100 }, { scheduler, duration: 200, onUpdate: () => {} })
    expect(delegated).toBe(false) // onUpdate kept it on the JS loop
  })

  it('a later animate() superseding a channel fires onInterrupt, not onComplete', () => {
    const { driver, scheduler, element } = setup()
    const events: string[] = []
    animate(
      element,
      { x: 100 },
      { scheduler, onComplete: () => events.push('complete'), onInterrupt: () => events.push('interrupt') },
    )
    driver.frame(0)
    driver.frame(16)
    animate(element, { x: 300 }, { scheduler }) // supersedes x
    settle(driver)
    expect(events).toEqual(['interrupt'])
  })

  it('superseding a registry property (color) fires onInterrupt, not onComplete', () => {
    const { driver, scheduler, element } = setup()
    element.style.backgroundColor = 'rgb(0, 0, 0)' // a resolvable start so the color springs, not snaps
    const events: string[] = []
    animate(
      element,
      { backgroundColor: 'rgb(255, 0, 0)' },
      { scheduler, onComplete: () => events.push('complete'), onInterrupt: () => events.push('interrupt') },
    )
    driver.frame(0)
    driver.frame(16)
    animate(element, { backgroundColor: 'rgb(0, 0, 255)' }, { scheduler }) // supersedes the color group
    settle(driver)
    expect(events).toEqual(['interrupt']) // the channel-group child reports its interrupt now
  })

  it('superseding a numeric keyframe channel fires onInterrupt, not onComplete', () => {
    const { driver, scheduler, element } = setup()
    const events: string[] = []
    animate(
      element,
      { x: [0, 50, 100] },
      { scheduler, onComplete: () => events.push('complete'), onInterrupt: () => events.push('interrupt') },
    )
    driver.frame(0)
    driver.frame(16)
    animate(element, { x: 300 }, { scheduler }) // interrupts the running keyframe chain on x
    settle(driver)
    expect(events).toEqual(['interrupt']) // the keyframe chain child reports its interrupt now
  })

  it('a non-scalar channel still completes cleanly when left to settle', async () => {
    const { driver, scheduler, element } = setup()
    element.style.backgroundColor = 'rgb(0, 0, 0)'
    const events: string[] = []
    const h = animate(
      element,
      { backgroundColor: 'rgb(255, 0, 0)' },
      { scheduler, onComplete: () => events.push('complete'), onInterrupt: () => events.push('interrupt') },
    )
    settle(driver)
    await h.finished
    expect(events).toEqual(['complete']) // natural settle is never mislabeled as an interrupt
  })

  it('calls back with the provided scope as `this`', async () => {
    const { driver, scheduler, element } = setup()
    const target = { started: false, done: false }
    const h = animate(
      element,
      { x: 100 },
      {
        scheduler,
        scope: target,
        onStart() {
          ;(this as typeof target).started = true
        },
        onComplete() {
          ;(this as typeof target).done = true
        },
      },
    )
    expect(target.started).toBe(true)
    settle(driver)
    await h.finished
    expect(target.done).toBe(true)
  })
})
