import { animatable, createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { playable } from '@underlying/core/playback'
import { describe, expect, it } from 'vitest'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

const el = {} as HTMLElement

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
  source.setBox(el, { start: 1000, size: 500 }) // default range -> enter 0, leave 1500
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source }) }
}

describe('scrub - locked (default)', () => {
  it('seeks a tween deterministically from scroll progress', () => {
    const { driver, scheduler, source, scroll } = setup()
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).to(600, { paused: true })
    scroll.scrub(handle, { target: el, range: ['start end', 'end start'] })

    source.emitScroll(750) // halfway through the range
    driver.frame(0)
    expect(handle.progress()).toBeCloseTo(0.5)

    source.emitScroll(1500) // end of the range
    driver.frame(16)
    expect(handle.progress()).toBeCloseTo(1)
  })

  it('bakes a physics handle once, then seeks it', () => {
    const { driver, scheduler, source, scroll } = setup()
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).spring(600, { paused: true })
    expect(handle.seekable).toBe(false)

    scroll.scrub(handle, { target: el })
    expect(handle.seekable).toBe(true) // baked at link time

    source.emitScroll(750)
    driver.frame(0)
    expect(handle.progress()).toBeCloseTo(0.5)
  })

  it('throws when a physics handle never rests and cannot bake', () => {
    const { scroll } = setup()
    const x = animatable(0)
    const handle = playable(x).spring(600, { paused: true, damping: 0 }) // undamped: never rests
    expect(() => scroll.scrub(handle, { target: el })).toThrow(/bake\(\) failed/)
  })

  it('drives a raw callback, always locked (smooth ignored)', () => {
    const { driver, source, scroll } = setup()
    const seen: number[] = []
    scroll.scrub((p) => seen.push(p), { target: el, smooth: 0.3 })
    expect(seen).toEqual([0]) // initial paint, no frame needed

    source.emitScroll(750)
    driver.frame(0)
    expect(seen.at(-1)).toBe(0.5) // instant, not smoothed
  })
})

describe('scrub - momentum', () => {
  it('lags the scroll through a follow() and converges', () => {
    const { driver, scheduler, source, scroll } = setup()
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).to(600, { paused: true })
    scroll.scrub(handle, { target: el, smooth: 0.1 })

    source.emitScroll(750) // aim at p = 0.5
    driver.frame(0) // controller sets the follow target; follow wakes (subscribes)
    driver.frame(16) // follow integrates one step toward it
    const p1 = handle.progress()
    expect(p1).toBeGreaterThan(0)
    expect(p1).toBeLessThan(0.5) // smoothed, has not caught up yet

    for (let t = 32; t <= 1600; t += 16) driver.frame(t)
    expect(handle.progress()).toBeCloseTo(0.5, 2) // settles on target
  })

  it('dispose() stops driving the handle', () => {
    const { driver, scheduler, source, scroll } = setup()
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).to(600, { paused: true })
    const scrub = scroll.scrub(handle, { target: el, smooth: 0.1 })

    source.emitScroll(750)
    driver.frame(0)
    scrub.dispose()
    const after = handle.progress()
    for (let t = 16; t <= 1600; t += 16) driver.frame(t)
    expect(handle.progress()).toBe(after) // no further movement once disposed
  })
})
