// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { __resetReducedMotion, setReducedMotionOverride } from '../a11y/reduced-motion'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animate, releaseStyle } from './animate'

type Driver = ReturnType<typeof createManualDriver>

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const div = (): HTMLElement => {
    const el = document.createElement('div')
    document.body.append(el)
    return el
  }
  const svg = (tag: string): SVGElement => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    document.body.append(el)
    return el
  }
  return { driver, scheduler, div, svg }
}

const settle = (driver: Driver): void => {
  for (let t = 0; t <= 4000; t += 16) driver.frame(t)
}

afterEach(() => {
  __resetReducedMotion()
  document.body.innerHTML = ''
})

describe('attribute routing (attr:)', () => {
  it('animates a numeric SVG attribute via setAttribute', async () => {
    const { driver, scheduler, svg } = setup()
    const circle = svg('circle')
    circle.setAttribute('r', '10')
    const handle = animate(circle, { 'attr:r': 40 }, { scheduler })
    settle(driver)
    await handle.finished
    expect(Number(circle.getAttribute('r'))).toBeCloseTo(40, 0)
    expect(circle.style.getPropertyValue('r')).toBe('') // wrote the attribute, not the style
  })

  it('keyframes a multi-number attribute (viewBox)', async () => {
    const { driver, scheduler, svg } = setup()
    const root = svg('svg')
    root.setAttribute('viewBox', '0 0 100 100')
    const handle = animate(root, { 'attr:viewBox': '0 0 50 50' }, { scheduler })
    settle(driver)
    await handle.finished
    expect(root.getAttribute('viewBox')).toBe('0 0 50 50')
  })

  it('drives an attribute and a style channel from one handle', async () => {
    const { driver, scheduler, svg } = setup()
    const circle = svg('circle')
    circle.setAttribute('r', '10')
    const handle = animate(circle, { 'attr:r': 30, opacity: 0.5 }, { scheduler })
    settle(driver)
    await handle.finished
    expect(Number(circle.getAttribute('r'))).toBeCloseTo(30, 0)
    expect(Number(circle.style.opacity)).toBeCloseTo(0.5, 1)
  })

  it('resolves a relative attribute against the live value', async () => {
    const { driver, scheduler, svg } = setup()
    const circle = svg('circle')
    circle.setAttribute('r', '20')
    const handle = animate([circle], { 'attr:r': '+=15' }, { scheduler })
    settle(driver)
    await handle.finished
    expect(Number(circle.getAttribute('r'))).toBeCloseTo(35, 0)
  })

  it('releaseStyle removes an animated attribute', () => {
    const { scheduler, svg } = setup()
    const circle = svg('circle')
    circle.setAttribute('r', '10')
    animate(circle, { 'attr:r': 40 }, { scheduler })
    releaseStyle(circle)
    expect(circle.hasAttribute('r')).toBe(false)
  })
})

describe('autoAlpha', () => {
  it('hides the element at opacity 0 and shows it above 0', async () => {
    const { driver, scheduler, div } = setup()
    const el = div()
    const handle = animate(el, { autoAlpha: 0 }, { scheduler })
    settle(driver)
    await handle.finished
    expect(Number(el.style.opacity)).toBeCloseTo(0, 1)
    expect(el.style.visibility).toBe('hidden')

    const back = animate(el, { autoAlpha: 1 }, { scheduler })
    settle(driver)
    await back.finished
    expect(Number(el.style.opacity)).toBeCloseTo(1, 1)
    expect(el.style.visibility).toBe('') // cleared once visible again
  })

  it('reveals from a hidden autoAlpha:0 start without staying hidden mid-rise', async () => {
    const { driver, scheduler, div } = setup()
    const el = div()
    animate(el, { autoAlpha: 0 }, { scheduler })
    settle(driver)
    expect(el.style.visibility).toBe('hidden')
    // Now reveal - once opacity leaves 0, visibility must clear (JS path, not WAAPI).
    animate(el, { autoAlpha: 1 }, { scheduler, duration: 200 })
    for (let t = 0; t <= 120; t += 16) driver.frame(t)
    expect(el.style.visibility).toBe('') // visible while rising
  })

  it('a later plain opacity animation unlinks autoAlpha and never re-hides', async () => {
    const { driver, scheduler, div } = setup()
    const el = div()
    animate(el, { autoAlpha: 0 }, { scheduler })
    settle(driver)
    expect(el.style.visibility).toBe('hidden')

    // A plain opacity call reveals and drops the visibility link.
    const reveal = animate(el, { opacity: 1 }, { scheduler })
    settle(driver)
    await reveal.finished
    expect(el.style.visibility).toBe('')

    // A subsequent plain opacity:0 must NOT hide it again (autoAlpha is unlinked).
    const fade = animate(el, { opacity: 0 }, { scheduler })
    settle(driver)
    await fade.finished
    expect(el.style.visibility).toBe('') // still visible-capable, no leaked hit-test drop
  })

  it('under reduced motion settles hidden at 0', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, div } = setup()
    const el = div()
    animate(el, { autoAlpha: 0 }, { scheduler, reducedMotion: 'skip' })
    settle(driver)
    expect(Number(el.style.opacity)).toBeCloseTo(0, 1)
    expect(el.style.visibility).toBe('hidden')
  })
})
