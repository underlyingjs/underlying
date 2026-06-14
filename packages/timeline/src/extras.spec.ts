import { animatable, createScheduler, linear } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { playable } from '@underlying/core/playback'
import { describe, expect, it } from 'vitest'
import { createTimeline } from './timeline'

const lin = { easing: linear }

describe('timeline - stagger', () => {
  it('fans a builder across items with each-ms spacing', () => {
    const ys = [animatable(0), animatable(0), animatable(0)]
    const tl = createTimeline().stagger(
      ys,
      (y) => playable(y).to(100, { paused: true, duration: 200, easing: linear }),
      { each: 100, at: 0 },
    )
    // items start at 0, 100, 200; each lasts 200 -> end at 400
    expect(tl.duration()).toBe(400)

    tl.seek(100) // item0 halfway (100/200), item1 just starting, item2 not yet
    expect(ys[0]!.get()).toBeCloseTo(50)
    expect(ys[1]!.get()).toBeCloseTo(0)
    expect(ys[2]!.get()).toBeCloseTo(0)

    tl.seek(400)
    for (const y of ys) expect(y.get()).toBeCloseTo(100)
  })

  it('from:end reverses the ripple order', () => {
    const ys = [animatable(0), animatable(0), animatable(0)]
    const tl = createTimeline().stagger(ys, (y) => playable(y).to(10, { paused: true, duration: 100, easing: linear }), {
      each: 100,
      from: 'end',
      at: 0,
    })
    // item2 starts at 0, item1 at 100, item0 at 200
    tl.seek(50)
    expect(ys[2]!.get()).toBeCloseTo(5) // last item moves first
    expect(ys[0]!.get()).toBeCloseTo(0)
  })
})

describe('timeline - master repeat', () => {
  it('loops the whole timeline when repeat is set', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const x = animatable(0)
    const tl = createTimeline({ scheduler, repeat: Number.POSITIVE_INFINITY }).to(x, 100, { duration: 200, ...lin })

    tl.play()
    // run well past one iteration; an infinite repeat never settles
    for (let t = 0; t <= 1000; t += 20) driver.frame(t)
    expect(x.get()).toBeGreaterThanOrEqual(0)
    expect(x.get()).toBeLessThanOrEqual(100)
    expect(tl.isPaused()).toBe(false) // still running
  })

  it('a finite repeat settles at the end', async () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const x = animatable(0)
    const tl = createTimeline({ scheduler, repeat: 1 }).to(x, 100, { duration: 200, ...lin })
    let settled = false
    void tl.finished.then(() => {
      settled = true
    })

    tl.play()
    for (let t = 0; t <= 1200; t += 20) driver.frame(t)
    await Promise.resolve()
    expect(x.get()).toBeCloseTo(100, 0)
    expect(settled).toBe(true)
  })
})
