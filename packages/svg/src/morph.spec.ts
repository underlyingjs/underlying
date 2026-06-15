// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { morph, type MorphElement } from './morph'
import type { PathGeometry } from './geometry'

const harness = () => {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  return { driver, scheduler }
}

// "from" outline: a horizontal segment at y=0, length 10.
const fromShape = (d: string): MorphElement => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  el.setAttribute('d', d)
  ;(el as unknown as { getTotalLength: () => number }).getTotalLength = () => 10
  ;(el as unknown as { getPointAtLength: (n: number) => { x: number; y: number } }).getPointAtLength = (n) => ({
    x: n,
    y: 0,
  })
  return el as unknown as MorphElement
}

// "to" outline: the same segment shifted to y=10.
const toShape: PathGeometry = {
  getTotalLength: () => 10,
  getPointAtLength: (n) => ({ x: n, y: 10 }),
}

describe('morph', () => {
  it('writes the original outline at fraction 0', () => {
    const { scheduler } = harness()
    const el = fromShape('M 0 0 L 10 0')
    morph(el, toShape, { samples: 3, scheduler })
    expect(el.getAttribute('d')).toBe('M 0 0 L 5 0 L 10 0')
  })

  it('interpolates point-by-point as the fraction rises', () => {
    const { driver, scheduler } = harness()
    const el = fromShape('M 0 0 L 10 0')
    const m = morph(el, toShape, { samples: 3, scheduler })
    m.set(0.5)
    driver.frame(16)
    expect(el.getAttribute('d')).toBe('M 0 5 L 5 5 L 10 5')
    m.set(1)
    driver.frame(32)
    expect(el.getAttribute('d')).toBe('M 0 10 L 5 10 L 10 10')
  })

  it('closes the outline when closed is set', () => {
    const { scheduler } = harness()
    const el = fromShape('M 0 0 L 10 0')
    morph(el, toShape, { samples: 3, closed: true, scheduler })
    expect(el.getAttribute('d')).toBe('M 0 0 L 5 0 L 10 0 Z')
  })

  it('revert restores the original d', () => {
    const { driver, scheduler } = harness()
    const el = fromShape('M 1 2 L 9 2')
    const m = morph(el, toShape, { samples: 3, scheduler })
    m.set(1)
    driver.frame(16)
    expect(el.getAttribute('d')).not.toBe('M 1 2 L 9 2')
    m.revert()
    expect(el.getAttribute('d')).toBe('M 1 2 L 9 2')
  })

  it('exposes a live fraction Animatable', () => {
    const { scheduler } = harness()
    const m = morph(fromShape('M 0 0 L 10 0'), toShape, { scheduler })
    expect(typeof m.fraction.get).toBe('function')
    expect(m.progress()).toBe(0)
  })
})
