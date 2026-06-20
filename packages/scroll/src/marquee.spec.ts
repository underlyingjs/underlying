// @vitest-environment jsdom
import { animatable, createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { marquee } from './marquee'

// jsdom has no layout, so mock the geometry the marquee measures: each element sits
// at index * STEP, the container is 250 wide. Clones inherit it via the prototype.
const STEP = 100
const CONTAINER = 250
const saved: Record<string, PropertyDescriptor | undefined> = {}
beforeEach(() => {
  for (const prop of ['offsetLeft', 'offsetTop', 'scrollWidth', 'scrollHeight', 'clientWidth', 'clientHeight']) {
    saved[prop] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, prop)
  }
  const indexStep = function (this: HTMLElement): number {
    const p = this.parentElement
    return p ? Array.prototype.indexOf.call(p.children, this) * STEP : 0
  }
  const childExtent = function (this: HTMLElement): number {
    return this.children.length * STEP
  }
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { configurable: true, get: indexStep })
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', { configurable: true, get: indexStep })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get: childExtent })
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: childExtent })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => CONTAINER })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => CONTAINER })
})
afterEach(() => {
  for (const [prop, desc] of Object.entries(saved)) {
    if (desc) Object.defineProperty(HTMLElement.prototype, prop, desc)
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop]
  }
  setReducedMotionOverride(null)
  document.body.innerHTML = ''
})

function buildTrack(items: number) {
  const container = document.createElement('div')
  const track = document.createElement('div')
  for (let i = 0; i < items; i++) track.appendChild(document.createElement('span'))
  container.appendChild(track)
  document.body.appendChild(container)
  return { container, track }
}
const sched = () => {
  const driver = createManualDriver()
  return { driver, scheduler: createScheduler(driver) }
}
const offsetOf = (track: HTMLElement): number => {
  const m = /translate3d\((-?[\d.]+)px/.exec(track.style.transform)
  return m ? -Number(m[1]) + 0 : 0 // render writes translate3d(-offset, 0, 0); +0 normalises -0
}

describe('marquee', () => {
  it('clones the content to fill, marking clones hidden', () => {
    const { track } = buildTrack(2)
    const m = marquee(track, { ...sched() })
    // period = 2 * 100 = 200; fill to >= 250 + 200 -> 6 children (2 original + 4 clones)
    expect(track.children.length).toBe(6)
    expect((track.children[2] as HTMLElement).getAttribute('aria-hidden')).toBe('true')
    m.dispose()
    expect(track.children.length).toBe(2) // clones removed
  })

  it('drifts and stays wrapped within one period (no seam)', () => {
    const { driver, scheduler } = sched()
    const { track } = buildTrack(2) // period 200
    const m = marquee(track, { speed: 120, scheduler })
    let moved = false
    for (let t = 0; t <= 6000; t += 16) {
      driver.frame(t)
      const off = offsetOf(track)
      expect(off).toBeGreaterThanOrEqual(-0.001)
      expect(off).toBeLessThan(200 + 0.001) // never past one period: the wrap is seamless
      if (off > 0) moved = true
    }
    expect(moved).toBe(true)
    m.dispose()
  })

  it('adds the velocity input to the drift', () => {
    const a = buildTrack(2)
    const b = buildTrack(2)
    const sa = sched()
    const sb = sched()
    const plain = marquee(a.track, { speed: 100, scheduler: sa.scheduler })
    const coupled = marquee(b.track, { speed: 100, velocity: animatable(800), scheduler: sb.scheduler })
    for (let t = 0; t <= 96; t += 16) {
      sa.driver.frame(t)
      sb.driver.frame(t)
    }
    expect(offsetOf(b.track)).toBeGreaterThan(offsetOf(a.track)) // velocity sped it up
    plain.dispose()
    coupled.dispose()
  })

  it('sits still under reduced motion and starts when it turns off', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler } = sched()
    const { track } = buildTrack(2)
    const m = marquee(track, { speed: 120, scheduler })
    for (let t = 0; t <= 500; t += 16) driver.frame(t)
    expect(offsetOf(track)).toBe(0) // no drift

    setReducedMotionOverride(false)
    for (let t = 500; t <= 1500; t += 16) driver.frame(t)
    expect(offsetOf(track)).toBeGreaterThan(0) // now drifting
    m.dispose()
  })

  it('eases the drift toward a stop on hover', () => {
    const { driver, scheduler } = sched()
    const { track } = buildTrack(2)
    const m = marquee(track, { speed: 200, pauseOnHover: true, scheduler })
    for (let t = 0; t <= 320; t += 16) driver.frame(t)
    const before = offsetOf(track)

    track.dispatchEvent(new MouseEvent('pointerenter'))
    for (let t = 320; t <= 1200; t += 16) driver.frame(t) // the pause spring settles to 0
    const afterPause = offsetOf(track)
    // advance more: a stopped marquee should barely move
    for (let t = 1200; t <= 1500; t += 16) driver.frame(t)
    const crept = offsetOf(track) - afterPause
    expect(before).toBeGreaterThan(0)
    expect(crept).toBeLessThan(2) // effectively halted
    m.dispose()
  })

  it('handles a single child and an empty track without breaking', () => {
    const one = buildTrack(1)
    const m1 = marquee(one.track, { speed: 100, scheduler: sched().scheduler })
    expect(one.track.children.length).toBeGreaterThan(1) // a single item is cloned to fill
    m1.dispose()

    const empty = buildTrack(0)
    const s = sched()
    const m0 = marquee(empty.track, { speed: 100, scheduler: s.scheduler })
    for (let t = 0; t <= 200; t += 16) s.driver.frame(t) // must not throw
    expect(empty.track.children.length).toBe(0)
    m0.dispose()
  })

  it('does not delete real children appended after construction', () => {
    const { track } = buildTrack(2)
    const m = marquee(track, { ...sched() })
    const real = document.createElement('span') // a genuine new child, not a clone
    track.appendChild(real)
    m.refresh()
    expect(track.contains(real)).toBe(true) // only flagged clones are stripped
    m.dispose()
  })

  it('dispose stops driving and restores the element', () => {
    const { driver, scheduler } = sched()
    const { track } = buildTrack(2)
    const m = marquee(track, { speed: 120, scheduler })
    for (let t = 0; t <= 200; t += 16) driver.frame(t)
    m.dispose()
    expect(track.style.transform).toBe('')
    const at = track.children.length
    for (let t = 200; t <= 600; t += 16) driver.frame(t)
    expect(track.children.length).toBe(at) // nothing re-driven
  })
})
