import { afterEach, describe, expect, it } from 'vitest'
import { setReducedMotionOverride } from '../a11y/reduced-motion'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { playable } from './playable'

type Driver = ReturnType<typeof createManualDriver>
function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const value = animatable(0, { scheduler })
  return { driver, scheduler, value }
}
const settle = (driver: Driver): void => {
  for (let t = 0; t <= 4000; t += 16) driver.frame(t)
}
afterEach(() => setReducedMotionOverride(null))

describe('animatable lifecycle callbacks', () => {
  it('fires start at launch, update per frame, complete at rest', () => {
    const { driver, value } = setup()
    const events: string[] = []
    value.spring(100, {
      stiffness: 180,
      onStart: () => events.push('start'),
      onUpdate: () => events.push('update'),
      onComplete: () => events.push('complete'),
    })
    expect(events[0]).toBe('start') // synchronous at launch
    settle(driver)
    expect(events).toContain('update')
    expect(events[events.length - 1]).toBe('complete')
  })

  it('onUpdate receives the same value as on(change)', () => {
    const { driver, value } = setup()
    const updates: number[] = []
    const changes: number[] = []
    value.on('change', (v) => changes.push(v))
    value.spring(100, { onUpdate: (v) => updates.push(v) })
    settle(driver)
    expect(updates).toEqual(changes)
  })

  it('a replacing animation interrupts the first (onInterrupt, not onComplete) and starts the second', () => {
    const { driver, value } = setup()
    const a: string[] = []
    const b: string[] = []
    value.spring(100, { onComplete: () => a.push('complete'), onInterrupt: () => a.push('interrupt') })
    value.spring(200, { onStart: () => b.push('start') }) // replaces the first
    expect(a).toEqual(['interrupt'])
    expect(b).toEqual(['start'])
    settle(driver)
    expect(a).toEqual(['interrupt']) // never completed
  })

  it('set/stop/dispose each fire onInterrupt', () => {
    for (const end of ['set', 'stop', 'dispose'] as const) {
      const { value } = setup()
      const events: string[] = []
      value.spring(100, { onInterrupt: () => events.push('interrupt') })
      if (end === 'set') value.set(50)
      else if (end === 'stop') value.stop()
      else value.dispose()
      expect(events).toEqual(['interrupt'])
    }
  })

  it('eventCallback attaches and clears post-hoc', () => {
    const { driver, value } = setup()
    const events: string[] = []
    const h = value.spring(100)
    h.eventCallback?.('complete', () => events.push('complete'))
    settle(driver)
    expect(events).toEqual(['complete'])

    const h2 = value.spring(0)
    const fn = (): void => {
      events.push('nope')
    }
    h2.eventCallback?.('complete', fn)
    h2.eventCallback?.('complete', null) // cleared
    settle(driver)
    expect(events).toEqual(['complete'])
  })

  it('a run started from within an onInterrupt does not emit a phantom start (re-entrancy)', () => {
    const { value } = setup()
    const order: string[] = []
    value.spring(100, {
      onStart: () => order.push('A:start'),
      onInterrupt: () => {
        order.push('A:interrupt')
        value.spring(300, { onStart: () => order.push('C:start') }) // re-enter from A's interrupt
      },
    })
    value.spring(200, {
      onStart: () => order.push('B:start'), // B replaces A but is itself replaced before it starts
      onInterrupt: () => order.push('B:interrupt'),
    })
    expect(order).toEqual(['A:start', 'A:interrupt', 'C:start'])
  })

  it('under reduced motion fires start then complete synchronously, never interrupt', () => {
    setReducedMotionOverride(true)
    const { value } = setup()
    const events: string[] = []
    value.spring(100, {
      onStart: () => events.push('start'),
      onComplete: () => events.push('complete'),
      onInterrupt: () => events.push('interrupt'),
    })
    expect(events).toEqual(['start', 'complete'])
  })
})

describe('playable lifecycle callbacks', () => {
  it('fires start on the first frame (after a delay), update per drive, complete at settle', () => {
    const { driver, scheduler, value } = setup()
    const events: string[] = []
    playable(value, { scheduler }).to(100, {
      duration: 200,
      delay: 100,
      onStart: () => events.push('start'),
      onUpdate: () => events.push('update'),
      onComplete: () => events.push('complete'),
    })
    driver.frame(0)
    driver.frame(50) // still within the delay
    expect(events).not.toContain('start')
    settle(driver)
    expect(events[0]).toBe('start')
    expect(events).toContain('update')
    expect(events[events.length - 1]).toBe('complete')
  })

  it('fires onRepeat once per iteration and completes at the end', () => {
    const { driver, scheduler, value } = setup()
    const events: string[] = []
    playable(value, { scheduler }).to(100, {
      duration: 100,
      repeat: 1,
      onRepeat: () => events.push('repeat'),
      onComplete: () => events.push('complete'),
    })
    settle(driver)
    expect(events.filter((e) => e === 'repeat')).toHaveLength(1)
    expect(events.filter((e) => e === 'complete')).toHaveLength(1)
  })

  it('repeat:Infinity never completes; stop fires onInterrupt', () => {
    const { driver, scheduler, value } = setup()
    const events: string[] = []
    const h = playable(value, { scheduler }).to(100, {
      duration: 100,
      repeat: Number.POSITIVE_INFINITY,
      onComplete: () => events.push('complete'),
      onInterrupt: () => events.push('interrupt'),
    })
    for (let t = 0; t <= 600; t += 16) driver.frame(t)
    expect(events).not.toContain('complete')
    h.stop()
    expect(events).toContain('interrupt')
  })

  it('a reversed seekable tween fires onReverseComplete, not onComplete', () => {
    const { driver, scheduler, value } = setup()
    const events: string[] = []
    const h = playable(value, { scheduler }).to(100, {
      duration: 200,
      onComplete: () => events.push('complete'),
      onReverseComplete: () => events.push('reverseComplete'),
    })
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    h.reverse() // play back toward the start
    settle(driver)
    expect(events).toContain('reverseComplete')
    expect(events).not.toContain('complete')
  })

  it('a yoyo loop completes (not reverseComplete) when it ends on a backward leg', () => {
    const { driver, scheduler, value } = setup()
    const events: string[] = []
    playable(value, { scheduler }).to(100, {
      duration: 60,
      repeat: 1,
      yoyo: true, // 2 legs -> ends backward at the launch, but it is NOT a user reverse
      onComplete: () => events.push('complete'),
      onReverseComplete: () => events.push('reverseComplete'),
    })
    settle(driver)
    expect(events).toEqual(['complete'])
  })

  it('the final onUpdate carries the settled endpoint, and matches on(change)', () => {
    const { driver, scheduler, value } = setup()
    const updates: number[] = []
    const changes: number[] = []
    value.on('change', (v) => changes.push(v))
    playable(value, { scheduler }).to(100, { duration: 100, onUpdate: (v) => updates.push(v) })
    settle(driver)
    expect(updates[updates.length - 1]).toBe(100) // exact endpoint, not one frame short
    expect(updates).toEqual(changes) // no extra no-op-frame updates
  })

  it('under reduced motion fires start then complete synchronously', () => {
    setReducedMotionOverride(true)
    const { scheduler, value } = setup()
    const events: string[] = []
    playable(value, { scheduler }).to(100, {
      duration: 200,
      onStart: () => events.push('start'),
      onComplete: () => events.push('complete'),
      onInterrupt: () => events.push('interrupt'),
    })
    expect(events).toEqual(['start', 'complete'])
  })
})
