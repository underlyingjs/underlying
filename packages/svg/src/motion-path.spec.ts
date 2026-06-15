// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { motionPath, type PathBindOptions } from './motion-path'
import type { PathGeometry } from './geometry'

const diagonal: PathGeometry = {
  getTotalLength: () => 100,
  getPointAtLength: (d) => ({ x: d * 0.6, y: d * 0.8 }),
}

const harness = () => {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const opts = (extra: Partial<PathBindOptions> = {}): PathBindOptions => ({ scheduler, ...extra })
  return { driver, scheduler, opts }
}

describe('motionPath', () => {
  it('writes the start point to transform synchronously at bind', () => {
    const { opts } = harness()
    const el = document.createElement('div')
    motionPath(el, diagonal, opts())
    expect(el.style.transform).toBe('translate3d(0px, 0px, 0)')
  })

  it('moves the element along the path when the driver is set and flushed', () => {
    const { driver, opts } = harness()
    const el = document.createElement('div')
    const mp = motionPath(el, diagonal, opts())
    mp.set(0.5)
    driver.frame(16)
    expect(el.style.transform).toBe('translate3d(30px, 40px, 0)')
  })

  it('autoRotate appends a rotate() to the path tangent', () => {
    const { driver, opts } = harness()
    const el = document.createElement('div')
    const mp = motionPath(el, diagonal, opts({ autoRotate: true }))
    mp.set(0.5)
    driver.frame(16)
    expect(el.style.transform).toMatch(/^translate3d\(30px, 40px, 0\) rotate\(53\.13/)
  })

  it('autoRotate as a number adds a fixed offset', () => {
    const { driver, opts } = harness()
    const el = document.createElement('div')
    const mp = motionPath(el, diagonal, opts({ autoRotate: 90 }))
    mp.set(0.5)
    driver.frame(16)
    expect(el.style.transform).toMatch(/rotate\(143\.13/) // 53.13 + 90
  })

  it('exposes a live t Animatable for composition', () => {
    const { opts } = harness()
    const el = document.createElement('div')
    const mp = motionPath(el, diagonal, opts())
    expect(typeof mp.t.get).toBe('function')
    expect(mp.progress()).toBe(0)
  })

  it('revert restores the previous transform', () => {
    const { driver, opts } = harness()
    const el = document.createElement('div')
    el.style.transform = 'none'
    const mp = motionPath(el, diagonal, opts())
    mp.set(0.8)
    driver.frame(16)
    expect(el.style.transform).toBe('translate3d(48px, 64px, 0)')
    mp.revert()
    expect(el.style.transform).toBe('none')
  })
})
