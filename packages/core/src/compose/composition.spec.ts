import { describe, expect, it } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { chain, stagger } from './composition'
import { staggerDelay } from './stagger-delay'

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function setup(count: number) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const values = Array.from({ length: count }, () => animatable(0, { scheduler }))
  return { driver, scheduler, values }
}

describe('stagger', () => {
  it('starts each item delayed by index * delayMs, on the frame clock', () => {
    const { driver, scheduler, values } = setup(3)
    stagger(values, (value) => value.spring(100), 50, { scheduler })

    expect(values[0]!.isAnimating()).toBe(true) // l'item 0 démarre immédiatement
    expect(values[1]!.isAnimating()).toBe(false)
    expect(values[2]!.isAnimating()).toBe(false)

    for (let t = 0; t <= 64; t += 16) driver.frame(t)
    expect(values[1]!.isAnimating()).toBe(true) // 50 ms de frames écoulées
    expect(values[2]!.isAnimating()).toBe(false) // 100 ms pas encore

    for (let t = 80; t <= 112; t += 16) driver.frame(t)
    expect(values[2]!.isAnimating()).toBe(true)
  })

  it('finished resolves once every item has rested', async () => {
    const { driver, scheduler, values } = setup(2)
    const handle = stagger(values, (value) => value.spring(100), 30, { scheduler })

    for (let t = 0; t <= 6000; t += 16) driver.frame(t)
    await handle.finished
    for (const value of values) expect(value.get()).toBe(100)
  })

  it('stop cancels pending starts and freezes running items', async () => {
    const { driver, scheduler, values } = setup(2)
    const handle = stagger(values, (value) => value.spring(100), 100, { scheduler })
    driver.frame(0)
    driver.frame(16)

    handle.stop()
    for (let t = 32; t <= 400; t += 16) driver.frame(t)

    expect(values[0]!.isAnimating()).toBe(false)
    expect(values[0]!.get()).toBeLessThan(100) // gelé en route
    expect(values[1]!.get()).toBe(0) // jamais démarré
    await handle.finished // résout, ne rejette jamais
  })

  it('an empty stagger resolves immediately', async () => {
    const { scheduler } = setup(0)
    await stagger([], () => {
      throw new Error('should not be called')
    }, 50, { scheduler }).finished
  })
})

describe('chain', () => {
  it('runs steps one after another', async () => {
    const { driver, values } = setup(2)
    const [a, b] = values
    chain([() => a!.spring(100), () => b!.spring(100)])

    expect(a!.isAnimating()).toBe(true)
    expect(b!.isAnimating()).toBe(false)

    let t = 0
    while (a!.isAnimating() && t <= 10_000) {
      driver.frame(t)
      t += 16
    }
    expect(a!.get()).toBe(100)
    await flushMicrotasks()
    expect(b!.isAnimating()).toBe(true) // l'étape 2 démarre après le repos de l'étape 1

    while (b!.isAnimating() && t <= 20_000) {
      driver.frame(t)
      t += 16
    }
    expect(b!.get()).toBe(100)
  })

  it('finished resolves after the last step', async () => {
    const { driver, values } = setup(2)
    const [a, b] = values
    const handle = chain([() => a!.spring(100), () => b!.spring(100)])

    let t = 0
    while (t <= 20_000) {
      driver.frame(t)
      t += 16
      if (!a!.isAnimating() && !b!.isAnimating()) {
        await flushMicrotasks()
        if (!a!.isAnimating() && !b!.isAnimating()) break
      }
    }
    await handle.finished
    expect(a!.get()).toBe(100)
    expect(b!.get()).toBe(100)
  })

  it('stop cancels the remaining steps', async () => {
    const { driver, values } = setup(2)
    const [a, b] = values
    const handle = chain([() => a!.spring(100), () => b!.spring(100)])
    driver.frame(0)
    driver.frame(16)

    handle.stop()
    for (let t = 32; t <= 4000; t += 16) driver.frame(t)
    await flushMicrotasks()

    expect(a!.isAnimating()).toBe(false)
    expect(a!.get()).toBeLessThan(100) // gelé
    expect(b!.isAnimating()).toBe(false)
    expect(b!.get()).toBe(0) // jamais démarré
    await handle.finished
  })

  it('an empty chain resolves immediately', async () => {
    await chain([]).finished
  })
})

describe('stagger with a DelayFn (expressive wave)', () => {
  it('accepts a staggerDelay() schedule as its third argument', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const values = Array.from({ length: 3 }, () => animatable(0, { scheduler }))
    // from 'end': the LAST item starts first, the first item last.
    stagger(values, (value) => value.spring(100), staggerDelay({ each: 50, from: 'end' }), { scheduler })

    expect(values[2]!.isAnimating()).toBe(true) // rank 0 -> starts now
    expect(values[0]!.isAnimating()).toBe(false) // rank max -> waits longest

    for (let t = 0; t <= 112; t += 16) driver.frame(t)
    expect(values[0]!.isAnimating()).toBe(true) // 100ms wave elapsed
  })
})
