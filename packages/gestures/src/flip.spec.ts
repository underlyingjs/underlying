// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { flip } from './flip'

const rect = (left: number, top: number, w = 10, h = 10): DOMRect =>
  ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('div')
  document.body.append(el)
  return { driver, scheduler, el }
}

describe('flip', () => {
  it('applies the inverse transform, then springs to identity', () => {
    const { driver, scheduler, el } = setup()
    let box = rect(100, 50) // First
    el.getBoundingClientRect = () => box
    flip(el, () => { box = rect(0, 0) }, { scheduler, stiffness: 300, damping: 26 })

    // inverted: the element appears at its First spot (no visual jump)
    expect(el.style.transform).toBe('translate3d(100px, 50px, 0)')

    for (let t = 0; t <= 6000; t += 16) driver.frame(t)
    expect(el.style.transform).toBe('') // settled at identity, transform cleared
  })

  it('does nothing when the box did not move', () => {
    const { scheduler, el } = setup()
    el.getBoundingClientRect = () => rect(0, 0)
    flip(el, () => {}, { scheduler })
    expect(el.style.transform).toBe('')
  })

  it('re-flipping mid-flight redirects from the live transform, never a jump', () => {
    const { driver, scheduler, el } = setup()
    let box = rect(200, 0)
    el.getBoundingClientRect = () => box
    flip(el, () => { box = rect(0, 0) }, { scheduler, stiffness: 120, damping: 20 })
    // part-way through the first flight
    for (let t = 0; t <= 200; t += 16) driver.frame(t)
    const midX = Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1] ?? '0')
    expect(midX).toBeGreaterThan(0)
    expect(midX).toBeLessThan(200) // moving, not at start, not arrived

    // re-flip: First is measured WITH the live transform (its current visual spot)
    box = rect(midX, 0)
    flip(el, () => { box = rect(0, 0) }, { scheduler, stiffness: 120, damping: 20 })
    // it should still be mid-flight, not snapped back to 200 or to 0
    const afterX = Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1] ?? '0')
    expect(afterX).toBeGreaterThan(0)
    expect(afterX).toBeLessThanOrEqual(midX + 0.001)

    for (let t = 216; t <= 8000; t += 16) driver.frame(t)
    expect(el.style.transform).toBe('') // still settles
  })
})
