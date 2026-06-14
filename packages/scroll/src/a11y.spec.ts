import { animatable, createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { playable } from '@underlying/core/playback'
import { describe, expect, it } from 'vitest'
import type { MotionPolicy } from './a11y'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

const el = {} as HTMLElement

/** A deterministic policy: no global core state, toggled by the test. */
function manualPolicy(initial = false) {
  let reduced = initial
  const listeners = new Set<(r: boolean) => void>()
  const policy: MotionPolicy = {
    reduced: () => reduced,
    onChange: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
  }
  return {
    policy,
    set(next: boolean) {
      if (next === reduced) return
      reduced = next
      for (const l of [...listeners]) l(next)
    },
  }
}

function setup(initialReduced = false) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
  source.setBox(el, { start: 1000, size: 500 }) // default range -> enter 0, leave 1500
  const a11y = manualPolicy(initialReduced)
  const scroll = createScroll({ scheduler, source, policy: a11y.policy })
  return { driver, scheduler, source, scroll, a11y }
}

describe('reduced motion', () => {
  it('momentum scrub collapses to locked', () => {
    const { driver, scheduler, source, scroll } = setup(true)
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).to(600, { paused: true })
    scroll.scrub(handle, { target: el, smooth: 0.3 })

    source.emitScroll(750)
    driver.frame(0)
    expect(handle.progress()).toBe(0.5) // instant, no follow smoothing
  })

  it('momentum scrub re-routes to locked when the preference toggles', () => {
    const { driver, scheduler, source, scroll, a11y } = setup(false)
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).to(600, { paused: true })
    scroll.scrub(handle, { target: el, smooth: 0.3 })

    a11y.set(true) // user turns on reduced motion mid-session

    source.emitScroll(750)
    driver.frame(0)
    expect(handle.progress()).toBe(0.5) // locked from the toggle on
  })

  it('parallax is disabled and held at the CSS rest', () => {
    const { driver, source, scroll } = setup(true)
    const value = scroll.parallax({ target: el, output: [40, 100] })
    expect(value.get()).toBe(0) // rest, not the output[0]=40 math

    source.emitScroll(750)
    driver.frame(0)
    expect(value.get()).toBe(0) // does not follow scroll
  })

  it('parallax re-enables when the preference clears', () => {
    const { driver, source, scroll, a11y } = setup(true)
    const value = scroll.parallax({ target: el, output: [0, 100] })
    expect(value.get()).toBe(0)

    a11y.set(false) // back to full motion
    source.emitScroll(750)
    driver.frame(0)
    expect(value.get()).toBe(50) // follows scroll again
  })
})
