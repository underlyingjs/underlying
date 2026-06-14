// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createScheduler } from '@underlying/core'
import { createManualDriver, type ManualDriver } from '@underlying/core/testing'
import { typewriter } from './typewriter'
import { scramble } from './scramble'

const pump = (driver: ManualDriver, toMs: number, step = 16): void => {
  for (let t = 0; t <= toMs; t += step) driver.frame(t)
}

describe('typewriter', () => {
  it('exposes the full text as the accessible name, then settles to it', async () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('p')
    const fx = typewriter(el, 'Hello', { duration: 500, scheduler })
    expect(el.getAttribute('aria-label')).toBe('Hello')

    pump(driver, 700)
    await fx.finished
    expect(el.textContent).toBe('Hello')
    expect(el.getAttribute('aria-label')).toBeNull() // restored (was none)
  })

  it('reveals a correct, growing prefix', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('p')
    typewriter(el, 'ABCDEFGH', { duration: 800, scheduler })
    pump(driver, 400)
    const shown = el.textContent ?? ''
    expect(shown.length).toBeGreaterThan(0)
    expect(shown.length).toBeLessThan(8)
    expect('ABCDEFGH'.startsWith(shown)).toBe(true)
  })
})

describe('scramble', () => {
  it('settles on the target text', async () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('p')
    const fx = scramble(el, 'DECODE', { duration: 600, scheduler })
    expect(el.getAttribute('aria-label')).toBe('DECODE')

    pump(driver, 800)
    await fx.finished
    expect(el.textContent).toBe('DECODE')
  })

  it('keeps the target length and reveals a correct prefix while scrambling the rest', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('p')
    scramble(el, 'DECODE', { duration: 800, scheduler })
    pump(driver, 400)
    const shown = el.textContent ?? ''
    expect(shown.length).toBe(6)
    expect(shown.startsWith('DEC')).toBe(true)
  })
})
