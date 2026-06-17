// @vitest-environment jsdom
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import { flip, play, snapshot } from './flip'

const rect = (left: number, top: number, w = 10, h = 10): DOMRect =>
  ({ left, top, right: left + w, bottom: top + h, width: w, height: h, x: left, y: top, toJSON: () => ({}) }) as DOMRect

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const el = document.createElement('div')
  document.body.append(el)
  return { driver, scheduler, el }
}

const settle = (driver: ReturnType<typeof createManualDriver>): void => {
  for (let t = 0; t <= 8000; t += 16) driver.frame(t)
}

describe('flip', () => {
  it('inverts position, then springs to identity', () => {
    const { driver, scheduler, el } = setup()
    let box = rect(100, 50)
    el.getBoundingClientRect = () => box
    flip(el, () => (box = rect(0, 0)), { scheduler, stiffness: 300, damping: 26 })
    expect(el.style.transform).toBe('translate3d(100px, 50px, 0)') // no scale when size is unchanged
    settle(driver)
    expect(el.style.transform).toBe('')
  })

  it('inverts size too (scale), then springs to identity', () => {
    const { driver, scheduler, el } = setup()
    let box = rect(0, 0, 100, 100)
    el.getBoundingClientRect = () => box
    flip(el, () => (box = rect(0, 0, 50, 50)), { scheduler, stiffness: 300, damping: 26 })
    expect(el.style.transform).toBe('translate3d(0px, 0px, 0) scale(2, 2)') // 100/50
    settle(driver)
    expect(el.style.transform).toBe('')
  })

  it('opts out of scale with { scale: false }', () => {
    const { scheduler, el } = setup()
    let box = rect(0, 0, 100, 100)
    el.getBoundingClientRect = () => box
    flip(el, () => (box = rect(0, 0, 50, 50)), { scheduler, scale: false })
    expect(el.style.transform).toBe('') // size change ignored, no position delta -> identity
  })

  it('does nothing when the box did not move', () => {
    const { scheduler, el } = setup()
    el.getBoundingClientRect = () => rect(0, 0)
    flip(el, () => {}, { scheduler })
    expect(el.style.transform).toBe('')
  })

  it('re-flipping mid-flight retargets from the live transform, never a jump', () => {
    const { driver, scheduler, el } = setup()
    let box = rect(200, 0)
    el.getBoundingClientRect = () => box
    flip(el, () => (box = rect(0, 0)), { scheduler, stiffness: 120, damping: 20 })
    for (let t = 0; t <= 200; t += 16) driver.frame(t)
    const midX = Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1] ?? '0')
    expect(midX).toBeGreaterThan(0)
    expect(midX).toBeLessThan(200)

    box = rect(midX, 0)
    flip(el, () => (box = rect(0, 0)), { scheduler, stiffness: 120, damping: 20 })
    const afterX = Number(/translate3d\((-?[\d.]+)px/.exec(el.style.transform)?.[1] ?? '0')
    expect(afterX).toBeGreaterThan(0)
    expect(afterX).toBeLessThanOrEqual(midX + 0.001) // continued, not snapped back to 200

    for (let t = 216; t <= 8000; t += 16) driver.frame(t)
    expect(el.style.transform).toBe('')
  })

  it('play() animates a new element from a snapshot box (shared element)', () => {
    const { driver, scheduler } = setup()
    const oldEl = document.createElement('div')
    oldEl.dataset.flipId = 'hero'
    oldEl.getBoundingClientRect = () => rect(200, 100, 40, 40)
    const snap = snapshot(oldEl)

    const newEl = document.createElement('div')
    newEl.dataset.flipId = 'hero'
    document.body.append(newEl)
    newEl.getBoundingClientRect = () => rect(0, 0, 80, 80)

    play(snap, { targets: newEl, scheduler, stiffness: 300, damping: 26 })
    expect(newEl.style.transform).toBe('translate3d(200px, 100px, 0) scale(0.5, 0.5)') // from the old box
    settle(driver)
    expect(newEl.style.transform).toBe('')
  })

  it('play() leaves a target with no matching key alone', () => {
    const { scheduler } = setup()
    const oldEl = document.createElement('div')
    oldEl.dataset.flipId = 'a'
    oldEl.getBoundingClientRect = () => rect(10, 10)
    const snap = snapshot(oldEl)

    const other = document.createElement('div')
    other.dataset.flipId = 'b' // not in the snapshot
    other.getBoundingClientRect = () => rect(0, 0)
    play(snap, { targets: other, scheduler })
    expect(other.style.transform).toBe('')
  })
})
