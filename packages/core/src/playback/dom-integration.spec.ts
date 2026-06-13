// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { bindStyle } from '../dom/bind-style'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { follow } from './follow'
import { playable } from './playable'

// The demo drives DOM elements by pairing an animatable with bindStyle and the
// playback layer. These assert that composition end to end: a baked spring
// scrubbed through bindStyle writes the element transform, and a follow value
// bound to an element tracks its moving target.
function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('div')
  return { driver, scheduler, el }
}

const translateX = (el: HTMLElement): number =>
  Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1] ?? Number.NaN)

function flush(driver: ManualDriver, fromMs: number, toMs: number): void {
  for (let t = fromMs; t <= toMs; t += 16) driver.frame(t)
}

describe('playback + bindStyle DOM integration', () => {
  it('scrubs a baked spring onto an element transform', () => {
    const { driver, scheduler, el } = setup()
    const x = animatable(0, { scheduler })
    bindStyle(el, { x }, { scheduler })
    const motion = playable(x, { scheduler }).spring(100, { stiffness: 120, damping: 9, paused: true })
    expect(motion.bake()).toBe(true)

    motion.progress(1) // seek to rest
    flush(driver, 0, 32) // let the render phase write
    expect(translateX(el)).toBe(100)

    motion.progress(0) // scrub back to the start
    flush(driver, 48, 80)
    expect(translateX(el)).toBe(0)
  })

  it('tracks a moving target through follow + bindStyle', () => {
    const { driver, scheduler, el } = setup()
    const lag = follow(0, { scheduler, stiffness: 120, damping: 22 })
    bindStyle(el, { x: lag.value }, { scheduler })

    lag.target(80)
    flush(driver, 0, 4000)
    expect(translateX(el)).toBeCloseTo(80, 0)
    lag.dispose()
  })
})
