import { describe, expect, it } from 'vitest'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { createSequence } from './sequence'

// Legs hand off across microtasks (await handle.finished), so frames must be
// pumped with a microtask flush between them for the chain to advance.
const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function setup(count: number) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const values = Array.from({ length: count }, () => animatable(0, { scheduler }))
  return { driver, scheduler, values }
}

async function pump(driver: ManualDriver, fromMs: number, toMs: number, step = 16): Promise<number> {
  let t = fromMs
  for (; t <= toMs; t += step) {
    driver.frame(t)
    await flush()
  }
  return t
}

describe('sequence()', () => {
  it('declares itself live and non-seekable', () => {
    const seq = createSequence()
    expect(seq.kind).toBe('sequence')
    expect(seq.seekable).toBe(false)
  })

  it('runs legs in strict order: the next starts only when the previous rests', async () => {
    const { driver, scheduler, values } = setup(2)
    const [a, b] = values
    createSequence({ scheduler }).spring(a!, 100).spring(b!, 100).play()

    await pump(driver, 0, 300)
    expect(a!.get()).toBeGreaterThan(0) // a is moving
    expect(b!.get()).toBe(0) // b has not started - a has not rested

    await pump(driver, 316, 8000)
    expect(a!.get()).toBe(100)
    expect(b!.get()).toBe(100) // b ran after a rested
  })

  it('overlap starts the next leg before the previous rests', async () => {
    const { driver, scheduler, values } = setup(2)
    const [a, b] = values
    createSequence({ scheduler })
      .spring(a!, 100, { stiffness: 50, damping: 18 }) // soft: still moving at 200ms
      .spring(b!, 100, { overlap: 80 })
      .play()

    await pump(driver, 0, 200)
    expect(b!.get()).toBeGreaterThan(0) // b started ~80ms in, via overlap
    expect(a!.get()).toBeLessThan(100) // a has not rested yet - they overlap
  })

  it('finished resolves when the last leg rests', async () => {
    const { driver, scheduler, values } = setup(2)
    const [a, b] = values
    const seq = createSequence({ scheduler }).spring(a!, 100).spring(b!, 100, { overlap: 50 }).play()

    await pump(driver, 0, 10000)
    await seq.finished
    expect(a!.get()).toBe(100)
    expect(b!.get()).toBe(100)
  })

  it('a same-value hand-off continues from the live position, never a restart', async () => {
    const { driver, scheduler, values } = setup(1)
    const [a] = values
    createSequence({ scheduler })
      .spring(a!, 100, { stiffness: 50, damping: 20 })
      .spring(a!, 0, { overlap: 120 }) // retarget the SAME value mid-flight
      .play()

    await pump(driver, 0, 220)
    const mid = a!.get()
    expect(mid).toBeGreaterThan(0) // it climbed toward 100...
    expect(mid).toBeLessThan(100) // ...and did not snap/jump when leg 2 took over

    await pump(driver, 236, 9000)
    expect(a!.get()).toBe(0) // leg 2 carried it back to 0
  })

  it('call fires its callback in chain order', async () => {
    const { driver, scheduler, values } = setup(1)
    const [a] = values
    const marks: string[] = []
    createSequence({ scheduler })
      .call(() => marks.push('before'))
      .spring(a!, 100)
      .call(() => marks.push('after'))
      .play()

    expect(marks).toEqual(['before']) // leg 0 fires synchronously on play()
    await pump(driver, 0, 8000)
    expect(marks).toEqual(['before', 'after'])
    expect(a!.get()).toBe(100)
  })

  it('stagger fans a builder across items as one leg', async () => {
    const { driver, scheduler, values } = setup(3)
    const seq = createSequence({ scheduler }).stagger(values, (v) => v.spring(100), { each: 40 }).play()

    await pump(driver, 0, 8000)
    await seq.finished
    for (const v of values) expect(v.get()).toBe(100)
  })

  it('stop freezes running legs, cancels pending ones, and resolves finished', async () => {
    const { driver, scheduler, values } = setup(2)
    const [a, b] = values
    const seq = createSequence({ scheduler }).spring(a!, 100).spring(b!, 100).play()

    await pump(driver, 0, 200) // a moving, b pending
    seq.stop()
    const frozen = a!.get()

    await pump(driver, 216, 3000)
    expect(a!.get()).toBe(frozen) // frozen in place
    expect(a!.get()).toBeLessThan(100)
    expect(b!.get()).toBe(0) // never started
    await seq.finished // resolves, never rejects
  })

  it('pause freezes the clock; resume continues from where it stopped', async () => {
    const { driver, scheduler, values } = setup(1)
    const [a] = values
    const seq = createSequence({ scheduler }).spring(a!, 100).play()

    await pump(driver, 0, 150)
    seq.pause()
    const paused = a!.get()
    expect(seq.isPaused()).toBe(true)

    await pump(driver, 166, 1200) // paused: no advance
    expect(a!.get()).toBe(paused)

    seq.resume()
    expect(seq.isPaused()).toBe(false)
    await pump(driver, 1216, 9000)
    expect(a!.get()).toBe(100)
  })

  it('timeScale is a getter and a setter', () => {
    const seq = createSequence()
    expect(seq.timeScale()).toBe(1)
    seq.timeScale(0.5)
    expect(seq.timeScale()).toBe(0.5)
  })

  it('replays from the top when authored with fromTo()', async () => {
    const { driver, scheduler, values } = setup(1)
    const [a] = values
    const seq = createSequence({ scheduler }).fromTo(a!, 0, 100).play()

    let t = await pump(driver, 0, 8000)
    expect(a!.get()).toBe(100)
    await seq.finished

    seq.play() // fresh run: fromTo resets the start to 0
    await flush()
    expect(a!.get()).toBeLessThan(100) // reset, tween not yet advanced

    await pump(driver, t + 16, t + 8000)
    expect(a!.get()).toBe(100)
  })

  it('an empty sequence resolves immediately', async () => {
    const { scheduler } = setup(0)
    await createSequence({ scheduler }).play().finished
  })
})
