// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { interactive } from './interactive'

type Driver = ReturnType<typeof createManualDriver>

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('button')
  document.body.append(el)
  return { driver, scheduler, el }
}
const settle = (driver: Driver): void => {
  for (let t = 0; t <= 1400; t += 16) driver.frame(t)
}
const point = (el: HTMLElement, type: string, pointerType?: string): void => {
  const ev = new MouseEvent(type)
  if (pointerType) Object.defineProperty(ev, 'pointerType', { value: pointerType })
  el.dispatchEvent(ev)
}
const key = (el: HTMLElement, k: string, type = 'keydown'): void => {
  el.dispatchEvent(new KeyboardEvent(type, { key: k }))
}
const scaleOf = (el: HTMLElement): number => {
  const m = /scale\(([\d.]+)\)/.exec(el.style.transform)
  return m ? Number(m[1]) : 1
}
const yOf = (el: HTMLElement): number => {
  const m = /translate3d\(-?[\d.]+px,\s*(-?[\d.]+)px/.exec(el.style.transform)
  return m ? Number(m[1]) : 0
}

afterEach(() => {
  setReducedMotionOverride(null)
  document.body.innerHTML = ''
})

describe('interactive', () => {
  it('springs to the hover state and back on leave', () => {
    const { driver, scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.1 }, scheduler })
    point(el, 'pointerenter')
    expect(i.state()).toBe('hover')
    settle(driver)
    expect(scaleOf(el)).toBeCloseTo(1.1, 1)

    point(el, 'pointerleave')
    expect(i.state()).toBe('rest')
    settle(driver)
    expect(scaleOf(el)).toBeCloseTo(1, 1)
    i.dispose()
  })

  it('press wins over hover, and merges channels the press does not set', () => {
    const { driver, scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.1 }, press: { y: 4 }, scheduler })
    point(el, 'pointerenter')
    point(el, 'pointerdown')
    expect(i.state()).toBe('press')
    settle(driver)
    expect(yOf(el)).toBeCloseTo(4, 0) // press sets y
    expect(scaleOf(el)).toBeCloseTo(1.1, 1) // and keeps the hover scale (press doesn't set it)

    point(el, 'pointerup')
    expect(i.state()).toBe('hover')
    settle(driver)
    expect(yOf(el)).toBeCloseTo(0, 0) // back to rest y
    i.dispose()
  })

  it('press overrides a shared channel', () => {
    const { driver, scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.1 }, press: { scale: 0.94 }, scheduler })
    point(el, 'pointerenter')
    point(el, 'pointerdown')
    settle(driver)
    expect(scaleOf(el)).toBeCloseTo(0.94, 1)
    i.dispose()
  })

  it('gives keyboard parity: focus = hover, Enter = press', () => {
    const { scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.1 }, press: { scale: 0.94 }, scheduler })
    el.dispatchEvent(new FocusEvent('focus'))
    expect(i.state()).toBe('hover')
    key(el, 'Enter')
    expect(i.state()).toBe('press')
    key(el, 'Enter', 'keyup')
    expect(i.state()).toBe('hover')
    el.dispatchEvent(new FocusEvent('blur'))
    expect(i.state()).toBe('rest')
    i.dispose()
  })

  it('filters emulated touch hover but still presses on tap', () => {
    const { scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.1 }, press: { scale: 0.94 }, scheduler })
    point(el, 'pointerenter', 'touch') // a tap's synthetic hover - ignored
    expect(i.state()).toBe('rest')
    point(el, 'pointerdown') // the tap itself is a press
    expect(i.state()).toBe('press')
    i.dispose()
  })

  it('snaps to the state under reduced motion', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.3 }, scheduler })
    point(el, 'pointerenter')
    driver.frame(0) // one frame to flush the bound style; a spring would still be mid-flight
    expect(scaleOf(el)).toBeCloseTo(1.3, 2)
    i.dispose()
  })

  it('does not stick in hover after a touch tap (focus is not hover on touch)', () => {
    const { scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.1 }, press: { scale: 0.94 }, scheduler })
    point(el, 'pointerenter', 'touch') // emulated hover - ignored
    point(el, 'pointerdown', 'touch') // the tap - lastPointerType = touch
    el.dispatchEvent(new FocusEvent('focus')) // tap keeps focus, but must not map to hover
    point(el, 'pointerup', 'touch')
    expect(i.state()).toBe('rest') // not stuck in hover
    i.dispose()
  })

  it('preventDefaults Space on a custom button but not a native one', () => {
    const { scheduler, el } = setup()
    const div = document.createElement('div')
    div.tabIndex = 0
    document.body.append(div)

    const iCustom = interactive(div, { press: { scale: 0.95 }, scheduler })
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true })
    div.dispatchEvent(space)
    expect(space.defaultPrevented).toBe(true) // custom button: stop the page scrolling
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    div.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(false)
    iCustom.dispose()

    const iNative = interactive(el, { press: { scale: 0.95 }, scheduler }) // el is a <button>
    const spaceNative = new KeyboardEvent('keydown', { key: ' ', cancelable: true })
    el.dispatchEvent(spaceNative)
    expect(spaceNative.defaultPrevented).toBe(false) // the browser handles native activation
    iNative.dispose()
  })

  it('dispose removes the listeners and unbinds', () => {
    const { driver, scheduler, el } = setup()
    const i = interactive(el, { hover: { scale: 1.2 }, scheduler })
    point(el, 'pointerenter')
    settle(driver)
    const before = el.style.transform
    i.dispose()
    point(el, 'pointerenter') // no listener anymore
    settle(driver)
    expect(el.style.transform).toBe(before) // frozen
  })
})
