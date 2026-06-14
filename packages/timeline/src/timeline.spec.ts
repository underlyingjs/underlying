import { animatable, createScheduler, linear } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import { createTimeline } from './timeline'

const lin = { easing: linear }

describe('timeline - seek', () => {
  it('an empty timeline is a settled, seekable handle of duration 0', () => {
    const tl = createTimeline()
    expect(tl.kind).toBe('timeline')
    expect(tl.seekable).toBe(true)
    expect(tl.duration()).toBe(0)
    expect(tl.progress()).toBe(1)
  })

  it('seeks two tweens to their correct positions', () => {
    const x = animatable(0)
    const o = animatable(0)
    const tl = createTimeline()
      .to(x, 100, { at: 0, duration: 1000, ...lin })
      .to(o, 1, { at: 500, duration: 500, ...lin })

    expect(tl.duration()).toBe(1000)

    tl.seek(0)
    expect(x.get()).toBe(0)
    expect(o.get()).toBe(0)

    tl.seek(500)
    expect(x.get()).toBeCloseTo(50) // halfway through x (linear)
    expect(o.get()).toBeCloseTo(0) // o has not started

    tl.seek(750)
    expect(x.get()).toBeCloseTo(75)
    expect(o.get()).toBeCloseTo(0.5) // halfway through o (500..1000)

    tl.seek(1000)
    expect(x.get()).toBeCloseTo(100)
    expect(o.get()).toBeCloseTo(1)
  })

  it('progress(p) equals seek(p * duration)', () => {
    const x = animatable(0)
    const tl = createTimeline().to(x, 200, { duration: 1000, ...lin })
    tl.progress(0.25)
    expect(x.get()).toBeCloseTo(50)
    expect(tl.progress()).toBeCloseTo(0.25)
  })

  it('from() tweens from an explicit start to the captured current value', () => {
    const x = animatable(50)
    const tl = createTimeline().from(x, 0, { duration: 400, ...lin })
    tl.seek(0)
    expect(x.get()).toBe(0)
    tl.seek(400)
    expect(x.get()).toBeCloseTo(50)
  })
})

describe('timeline - live clock', () => {
  it('plays forward, freezes on pause, finishes at the end', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const x = animatable(0)
    const tl = createTimeline({ scheduler }).to(x, 100, { duration: 1000, ...lin })

    tl.play()
    for (let t = 0; t <= 300; t += 20) driver.frame(t)
    const mid = x.get()
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(100)

    tl.pause()
    for (let t = 320; t <= 700; t += 20) driver.frame(t)
    expect(x.get()).toBe(mid) // frozen while paused

    tl.play()
    for (let t = 720; t <= 2200; t += 20) driver.frame(t)
    expect(x.get()).toBeCloseTo(100, 0)
  })

  it('timeScale dilates time without changing the path', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const x = animatable(0)
    const tl = createTimeline({ scheduler }).to(x, 100, { duration: 1000, ...lin })

    tl.timeScale(0.5).play()
    for (let t = 0; t <= 1200; t += 20) driver.frame(t)
    expect(x.get()).toBeGreaterThan(0)
    expect(x.get()).toBeLessThan(100) // at half speed, 1200ms wall = ~600ms timeline
  })
})

describe('timeline - physics children', () => {
  it('bakes a spring clip to a finite, seekable trajectory', () => {
    const x = animatable(0)
    const tl = createTimeline().spring(x, 100, { stiffness: 120, damping: 22 })
    const d = tl.duration()
    expect(d).toBeGreaterThan(0)

    tl.seek(0)
    expect(x.get()).toBe(0)
    tl.seek(d)
    expect(x.get()).toBeCloseTo(100, 0)
  })

  it('sequential clips on one value chain from the prior exit', () => {
    const x = animatable(0)
    const tl = createTimeline()
      .to(x, 100, { duration: 500, ...lin }) // 0 -> 100
      .spring(x, 200, { stiffness: 120, damping: 22 }) // starts at 100, springs to 200
    const d = tl.duration()

    tl.seek(500)
    expect(x.get()).toBeCloseTo(100, 0) // the seam

    tl.seek(d)
    expect(x.get()).toBeCloseTo(200, 0)
  })
})
