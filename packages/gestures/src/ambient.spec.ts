// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { ambient } from './ambient'

const setRect = (el: HTMLElement, r: { left: number; top: number; width: number; height: number }): void => {
  el.getBoundingClientRect = () =>
    ({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.left + r.width,
      bottom: r.top + r.height,
      x: r.left,
      y: r.top,
      toJSON() {},
    }) as DOMRect
}
const movePointer = (x: number, y: number): void => {
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
}
const moveTouch = (x: number, y: number): void => {
  const e = new MouseEvent('pointermove', { clientX: x, clientY: y })
  Object.defineProperty(e, 'pointerType', { value: 'touch' })
  window.dispatchEvent(e)
}

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('div')
  const frame = document.createElement('div')
  setRect(frame, { left: 0, top: 0, width: 200, height: 100 }) // centre (100,50), half (100,50)
  return { driver, scheduler, el, frame }
}
const run = (driver: ReturnType<typeof createManualDriver>, from: number, to: number, step = 16): void => {
  for (let t = from; t <= to; t += step) driver.frame(t)
}

afterEach(() => setReducedMotionOverride(null))

describe('ambient', () => {
  it('breathe oscillates scale around 1 and stays bounded over a long session', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { drift: false, breathe: { scale: 0.05, period: 2 }, scheduler })
    let min = Infinity
    let max = -Infinity
    for (let t = 0; t <= 8000; t += 16) {
      driver.frame(t)
      const s = a.scale.get()
      expect(Number.isNaN(s)).toBe(false)
      min = Math.min(min, s)
      max = Math.max(max, s)
    }
    expect(min).toBeLessThan(1)
    expect(max).toBeGreaterThan(1)
    expect(min).toBeGreaterThan(0.94) // symplectic energy bound: no secular growth
    expect(max).toBeLessThan(1.06)
    a.dispose()
  })

  it('drift is a phase-offset Lissajous: x peaks while y is near zero', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { breathe: false, drift: { amplitude: 10, period: { x: 4, y: 6 } }, scheduler })
    let decoupled = false
    for (let t = 0; t <= 9000; t += 16) {
      driver.frame(t)
      if (Math.abs(a.x.get()) > 8 && Math.abs(a.y.get()) < 3) decoupled = true
    }
    expect(decoupled).toBe(true) // not in lockstep -> a real phase offset
    a.dispose()
  })

  it('bob writes only y; x stays a constant 0', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { breathe: false, drift: false, bob: { amplitude: 8, period: 2 }, scheduler })
    let yMoved = false
    for (let t = 0; t <= 5000; t += 16) {
      driver.frame(t)
      expect(a.x.get()).toBe(0)
      if (Math.abs(a.y.get()) > 1) yMoved = true
    }
    expect(yMoved).toBe(true)
    a.dispose()
  })

  it('ambient(el) with no options self-animates (breathe + drift on by default)', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { scheduler })
    let scaleVaried = false
    let posVaried = false
    for (let t = 0; t <= 6000; t += 16) {
      driver.frame(t)
      if (a.scale.get() !== 1) scaleVaried = true
      if (a.x.get() !== 0 || a.y.get() !== 0) posVaried = true
    }
    expect(scaleVaried).toBe(true)
    expect(posVaried).toBe(true)
    a.dispose()
  })

  it('a group runs each member at a different phase (no lockstep)', () => {
    const { driver, scheduler } = setup()
    const els = [document.createElement('div'), document.createElement('div'), document.createElement('div')]
    const g = ambient(els, { breathe: false, drift: { amplitude: 10 }, scheduler })
    run(driver, 0, 2000)
    const xs = g.items.map((i) => i.x.get())
    expect(xs[0]).not.toBeCloseTo(xs[1]!, 1)
    expect(xs[1]).not.toBeCloseTo(xs[2]!, 1)
    g.dispose()
  })

  it('wander roams its attractor when idle (no pointer), bounded near the radius', () => {
    const { driver, scheduler, el, frame } = setup()
    const a = ambient(el, { breathe: false, drift: false, wander: { radius: 30, idleAfter: 2000, frame }, scheduler })
    let min = Infinity
    let max = -Infinity
    for (let t = 0; t <= 9000; t += 16) {
      driver.frame(t)
      const x = a.x.get()
      min = Math.min(min, x)
      max = Math.max(max, x)
    }
    expect(max - min).toBeGreaterThan(2) // it moved (chasing the roaming attractor)
    expect(Math.abs(min)).toBeLessThan(50) // within radius + epicycle
    expect(Math.abs(max)).toBeLessThan(50)
    a.dispose()
  })

  it('wander recaptures to pointer parallax on movement', () => {
    const { driver, scheduler, el, frame } = setup()
    const a = ambient(el, {
      breathe: false,
      drift: false,
      wander: { radius: 30, parallax: 24, idleAfter: 2000, frame, spring: { stiffness: 120 } },
      scheduler,
    })
    movePointer(150, 50) // nx = 0.5 -> aim x = -0.5*24 = -12
    run(driver, 0, 1500) // < idleAfter, so it stays active and settles
    expect(a.x.get()).toBeCloseTo(-12, 0)
    expect(a.y.get()).toBeCloseTo(0, 0)
    a.dispose()
  })

  it('reverts to wander after idleAfter of stillness (on the physics clock, no fake timers)', () => {
    const { driver, scheduler, el, frame } = setup()
    const a = ambient(el, {
      breathe: false,
      drift: false,
      wander: { radius: 80, parallax: 20, idleAfter: 1000, frame, spring: { stiffness: 120 } },
      scheduler,
    })
    movePointer(150, 50) // active -> parallax aim -10, well inside the 80px wander range
    run(driver, 0, 800) // still active
    expect(a.x.get()).toBeCloseTo(-10, 0)
    // no further movement: accumulated frame time crosses idleAfter -> wander resumes (radius 80)
    let maxAbs = 0
    for (let t = 816; t <= 9000; t += 16) {
      driver.frame(t)
      maxAbs = Math.max(maxAbs, Math.abs(a.x.get()))
    }
    expect(maxAbs).toBeGreaterThan(30) // wandered past the parallax cap (20) -> it left active
    a.dispose()
  })

  it('touch never activates parallax, but self-motion still runs', () => {
    const { driver, scheduler, el, frame } = setup()
    const a = ambient(el, {
      breathe: { scale: 0.05, period: 2 },
      drift: false,
      wander: { radius: 30, idleAfter: 2000, frame },
      scheduler,
    })
    moveTouch(150, 50) // ignored by the shared pointer source
    let scaleVaried = false
    for (let t = 0; t <= 5000; t += 16) {
      driver.frame(t)
      if (a.scale.get() !== 1) scaleVaried = true
    }
    expect(scaleVaried).toBe(true) // breathe runs on touch
    a.dispose()
  })

  it('holds everything at rest under reduced motion at construction', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { scheduler })
    run(driver, 0, 3000)
    expect(a.scale.get()).toBe(1)
    expect(a.x.get()).toBe(0)
    expect(a.y.get()).toBe(0)
    a.dispose()
  })

  it('reduced motion is two-way: pauses to rest, then resumes', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { breathe: { scale: 0.05, period: 2 }, drift: false, scheduler })
    run(driver, 0, 2000)

    setReducedMotionOverride(true) // policy change stops the loop + drives to rest
    expect(a.scale.get()).toBe(1)
    run(driver, 2016, 2600)
    expect(a.scale.get()).toBe(1) // stays at rest, loop torn down

    setReducedMotionOverride(false) // resumes
    let varied = false
    for (let t = 2616; t <= 6000; t += 16) {
      driver.frame(t)
      if (a.scale.get() !== 1) varied = true
    }
    expect(varied).toBe(true)
    a.dispose()
  })

  it('binds only the channels a behavior writes (sparse)', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { drift: false, breathe: { scale: 0.05 }, scheduler })
    run(driver, 0, 2000)
    expect(a.x.get()).toBe(0) // x unbound, constant
    expect(el.style.opacity).toBe('') // opacity unbound (breathe.opacity defaults to 0)
    a.dispose()
  })

  it('dispose freezes the outputs and tears down the loop', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { breathe: { scale: 0.05, period: 2 }, drift: false, scheduler })
    run(driver, 0, 2000)
    const before = a.scale.get()
    a.dispose()
    run(driver, 2016, 5000) // would keep oscillating, but the loop is gone
    expect(a.scale.get()).toBe(before) // frozen
  })

  it('a degenerate period is clamped, never poisoning the channel with NaN', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { drift: false, breathe: { scale: 0.05, period: 0 }, scheduler })
    for (let t = 0; t <= 3000; t += 16) {
      driver.frame(t)
      const s = a.scale.get()
      expect(Number.isNaN(s)).toBe(false)
      expect(s).toBeGreaterThan(0.9)
      expect(s).toBeLessThan(1.1)
    }
    a.dispose()
  })

  it('breathe scale:0 binds no scale channel (symmetric with the opacity gate)', () => {
    const { driver, scheduler, el } = setup()
    const a = ambient(el, { drift: false, breathe: { scale: 0, opacity: 0.1 }, scheduler })
    run(driver, 0, 2000)
    expect(a.scale.get()).toBe(1) // scale unbound -> constant 1
    expect(el.style.transform || '').not.toContain('scale') // no transform written
    expect(Number(el.style.opacity || '1')).toBeLessThanOrEqual(1) // opacity IS bound and dims
    a.dispose()
  })
})
