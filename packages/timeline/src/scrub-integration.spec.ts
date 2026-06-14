import { animatable, createScheduler, linear } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { createManualScrollSource, createScroll } from '@underlying/scroll'
import { describe, expect, it } from 'vitest'
import { createTimeline } from './timeline'

// The keystone: a timeline IS a seekable PlaybackHandle, so @underlying/scroll's
// scrub() binds it with zero special-casing (no bake at bind, no throw).
describe('scroll scrubs a timeline', () => {
  it('locked scrub drives the timeline children from scroll position', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
    const scroll = createScroll({ scheduler, source })

    const x = animatable(0)
    const tl = createTimeline().to(x, 100, { duration: 1000, easing: linear })
    scroll.scrub(tl) // smooth:false (default) -> handle.progress(p) each frame

    source.emitScroll(1000) // scroll progress 0.5
    driver.frame(0)
    expect(x.get()).toBeCloseTo(50)

    source.emitScroll(2000) // scroll progress 1
    driver.frame(16)
    expect(x.get()).toBeCloseTo(100)

    source.emitScroll(500) // back to 0.25 - reversible
    driver.frame(32)
    expect(x.get()).toBeCloseTo(25)

    scroll.dispose()
  })
})
