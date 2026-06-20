// @vitest-environment jsdom
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import type { MotionPolicy } from './a11y'
import { createScroll, type ScrollControllerInternal } from './controller'
import { createDomScrollSource } from './source-dom'
import { createManualScrollSource } from './source-manual'

type Driver = ReturnType<typeof createManualDriver>

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
  const set = (r: boolean): void => {
    reduced = r
    for (const l of [...listeners]) l(r)
  }
  return { policy, set }
}

const live: ScrollControllerInternal[] = []
function setup(opts: { smooth?: boolean | { smooth?: number }; reduced?: boolean; maxScroll?: number } = {}) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ scrollPos: 0, viewportSize: 800, maxScroll: opts.maxScroll ?? 2000 })
  const { policy, set: setReduced } = manualPolicy(opts.reduced ?? false)
  const scroll = createScroll({ source, scheduler, policy, smooth: opts.smooth ?? true }) as ScrollControllerInternal
  live.push(scroll)
  return { driver, scheduler, source, scroll, setReduced }
}

const settle = (driver: Driver): void => {
  for (let t = 0; t <= 2400; t += 16) driver.frame(t)
}
const wheel = (deltaY: number): void => {
  window.dispatchEvent(new WheelEvent('wheel', { deltaY, cancelable: true }))
}
const key = (k: string, init: KeyboardEventInit = {}): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, ...init }))
}

afterEach(() => {
  for (const c of live.splice(0)) c.dispose() // detach each engine's window listeners
  document.body.innerHTML = ''
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
})

describe('source driveTo', () => {
  it('manual source: sets the position and fires onScroll synchronously', () => {
    const source = createManualScrollSource({ maxScroll: 1000 })
    let fires = 0
    source.onScroll(() => {
      fires += 1
    })
    source.driveTo(250)
    expect(source.scrollPos()).toBe(250)
    expect(fires).toBe(1)
  })

  it('dom source: caches synchronously and swallows its own native echo', () => {
    const el = document.createElement('div')
    el.scrollTo = () => {} // jsdom element has no scrollTo
    const source = createDomScrollSource({ scroller: el })
    let fires = 0
    source.onScroll(() => {
      fires += 1
    })
    source.driveTo(120)
    expect(source.scrollPos()).toBe(120)
    expect(fires).toBe(1)

    // the browser's later 'scroll' echo reflecting the driven position is self-induced
    el.scrollTop = 120
    el.dispatchEvent(new Event('scroll'))
    expect(fires).toBe(1)

    // a genuine user scroll to a different value fans out
    el.scrollTop = 600
    el.dispatchEvent(new Event('scroll'))
    expect(fires).toBe(2)
    source.dispose()
  })
})

describe('smooth scroll engine', () => {
  it('springs the smoothed position to a wheel target, then sleeps', () => {
    const { driver, source } = setup({ smooth: true })
    wheel(300)
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(300, 0)
  })

  it('clamps the aim to [0, maxScroll]', () => {
    const { driver, source, scroll } = setup({ smooth: true, maxScroll: 1000 })
    wheel(50000)
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(1000, 0)
    expect(scroll.smooth().target()).toBe(1000)
  })

  it('a consumer reads the smoothed position (progress tracks it)', () => {
    const { driver, scroll } = setup({ smooth: true, maxScroll: 2000 })
    wheel(500)
    settle(driver)
    expect(scroll.progress()).toBeCloseTo(0.25, 1) // 500 / 2000
  })

  it('routes keyboard through the spring, but never steals a form field', () => {
    const { driver, source } = setup({ smooth: true })
    key('ArrowDown')
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(40, 0)

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    const before = source.scrollPos()
    key('ArrowDown') // focus is in the input -> not intercepted
    settle(driver)
    expect(source.scrollPos()).toBe(before)
  })

  it('adopts a user scroll instead of fighting it', () => {
    const { driver, source, scroll } = setup({ smooth: true })
    source.emitScroll(500) // a scrollbar drag the engine did not drive
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(500, 0) // engine followed, did not snap back to 0
    expect(scroll.smooth().target()).toBeCloseTo(500, 0)
  })

  it('is disabled and inert under reduced motion, and resumes when it turns off', () => {
    const { driver, source, scroll, setReduced } = setup({ smooth: true, reduced: true })
    const engine = scroll.smooth()
    expect(engine.enabled()).toBe(false)
    wheel(300) // no listener attached
    settle(driver)
    expect(source.scrollPos()).toBe(0)

    setReduced(false)
    expect(engine.enabled()).toBe(true)
    wheel(300)
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(300, 0)
  })

  it('ignores keyboard shortcuts held with a non-shift modifier', () => {
    const { driver, source } = setup({ smooth: true })
    key('ArrowDown', { metaKey: true }) // Cmd+Down is an OS shortcut - do not hijack
    settle(driver)
    expect(source.scrollPos()).toBe(0)
  })

  it('lets a wheel at the scroll limit chain instead of trapping it', () => {
    const { driver, source } = setup({ smooth: true, maxScroll: 200 })
    wheel(50000)
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(200, 0) // at the bottom
    const ev = new WheelEvent('wheel', { deltaY: 300, cancelable: true })
    window.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(false) // not absorbed; chains to the page
  })

  it('refresh does not restart the spring after reduced motion detaches it', () => {
    const { driver, source, scroll, setReduced } = setup({ smooth: true, maxScroll: 2000 })
    const engine = scroll.smooth()
    wheel(800)
    settle(driver)
    setReduced(true) // detach, the spring stops where it rested
    source.setLayout({ maxScroll: 100 }) // a resize shrinks below the resting aim
    const before = source.scrollPos()
    engine.refresh()
    settle(driver)
    expect(source.scrollPos()).toBe(before) // refresh must not drive native scroll while detached
  })

  it('re-aims correctly to the old target after reduced motion toggles off', () => {
    const { driver, source, scroll, setReduced } = setup({ smooth: true, maxScroll: 2000 })
    const engine = scroll.smooth()
    wheel(500)
    settle(driver) // aim 500, the spring's lastTarget is 500
    setReduced(true)
    source.emitScroll(1000) // the user scrolled raw to 1000 while reduced
    setReduced(false) // re-attach, re-seed to 1000
    wheel(-500) // aim back to exactly 500 - the stale lastTarget
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(500, 0) // not stranded at 1000
    void engine
  })

  it('dispose stops driving and detaches listeners', () => {
    const { driver, source, scroll } = setup({ smooth: true })
    wheel(200)
    settle(driver)
    const resting = source.scrollPos()
    scroll.dispose()
    wheel(400) // no listener anymore
    settle(driver)
    expect(source.scrollPos()).toBe(resting)
  })
})

describe('scroll-to / snap unification', () => {
  it('scrollTo routes through the engine spring, not a second writer', async () => {
    const { driver, source, scroll } = setup({ smooth: true, maxScroll: 2000 })
    const engine = scroll.smooth()
    const handle = scroll.scrollTo(1000)
    expect(engine.target()).toBe(1000) // the engine owns the aim
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(1000, 0)
    await expect(handle.finished).resolves.toBeUndefined()
  })

  it('hands an in-flight scrollTo to the engine when smooth() is enabled mid-flight', () => {
    const { driver, source, scroll } = setup({ smooth: false, maxScroll: 2000 })
    const handle = scroll.scrollTo(1000) // builds its own follow (no engine yet)
    driver.frame(0)
    driver.frame(16)
    expect(source.scrollPos()).toBeGreaterThan(0)
    expect(source.scrollPos()).toBeLessThan(1000)

    const engine = scroll.smooth() // enable smooth mid-flight
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(1000, 0) // still lands, with one writer
    expect(engine.target()).toBeCloseTo(1000, 0)
    void handle
  })

  it('engine-mode scrollTo cancel() freezes the scroller in place', () => {
    const { driver, source, scroll } = setup({ smooth: { smooth: 0.5 }, maxScroll: 2000 }) // slow: stays mid-flight
    const handle = scroll.scrollTo(2000)
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    const at = source.scrollPos()
    expect(at).toBeGreaterThan(0)
    expect(at).toBeLessThan(2000)

    handle.cancel() // freeze here, no momentum glide
    driver.frame(48)
    driver.frame(64)
    expect(source.scrollPos()).toBeCloseTo(at, 0)
  })

  it('snap routes its stop through the engine spring', () => {
    const { driver, source, scroll } = setup({ smooth: true, maxScroll: 1000 })
    const engine = scroll.smooth()
    scroll.snap({ to: [0, 1] }) // snap to 0 or maxScroll

    source.emitScroll(300) // user moved to 30%, upward direction
    driver.frame(0) // moving
    driver.frame(16) // idle 1
    driver.frame(32) // idle 2 -> startSnap routes to the engine
    expect(engine.target()).toBe(1000) // nearest stop in the travel direction
    settle(driver)
    expect(source.scrollPos()).toBeCloseTo(1000, 0)
  })
})
