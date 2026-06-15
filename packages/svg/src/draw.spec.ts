// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { draw, type DrawInput } from './draw'

const harness = () => {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  return { driver, scheduler }
}

// A real element (for .style) with a faked geometry length - jsdom has no
// getTotalLength on SVG, so we stub it.
const strokePath = (length: number): DrawInput => {
  const el = document.createElement('div')
  ;(el as unknown as { getTotalLength: () => number }).getTotalLength = () => length
  return el as unknown as DrawInput
}

describe('draw', () => {
  it('sets stroke-dasharray to the length and starts hidden', () => {
    const { scheduler } = harness()
    const path = strokePath(120)
    draw(path, { scheduler })
    const style = (path as unknown as HTMLElement).style
    expect(style.strokeDasharray).toBe('120')
    expect(style.strokeDashoffset).toBe('120') // fraction 0 -> fully hidden
  })

  it('draws the stroke on as the fraction rises', () => {
    const { driver, scheduler } = harness()
    const path = strokePath(120)
    const style = (path as unknown as HTMLElement).style
    const d = draw(path, { scheduler })
    d.set(0.25)
    driver.frame(16)
    expect(style.strokeDashoffset).toBe('90') // 120 * (1 - 0.25)
    d.set(1)
    driver.frame(32)
    expect(style.strokeDashoffset).toBe('0')
  })

  it('starts already drawn when from is 1', () => {
    const { scheduler } = harness()
    const path = strokePath(120)
    draw(path, { scheduler, from: 1 })
    expect((path as unknown as HTMLElement).style.strokeDashoffset).toBe('0')
  })

  it('revert restores the original stroke-dash properties', () => {
    const { scheduler } = harness()
    const path = strokePath(120)
    const style = (path as unknown as HTMLElement).style
    style.strokeDasharray = '4 2'
    style.strokeDashoffset = '7'
    const d = draw(path, { scheduler })
    d.revert()
    expect(style.strokeDasharray).toBe('4 2')
    expect(style.strokeDashoffset).toBe('7')
  })

  it('exposes a live fraction Animatable', () => {
    const { scheduler } = harness()
    const d = draw(strokePath(50), { scheduler })
    expect(typeof d.fraction.get).toBe('function')
    expect(d.progress()).toBe(0)
  })
})
