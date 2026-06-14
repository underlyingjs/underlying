// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver, type ManualDriver } from '@underlying/core/testing'
import { reveal } from './reveal'

const pump = (driver: ManualDriver, toMs: number, step = 16): void => {
  for (let t = 0; t <= toMs; t += step) driver.frame(t)
}

afterEach(() => setReducedMotionOverride(null))

describe('reveal', () => {
  it('staggers the pieces in: a late one is still hidden, then everything settles visible', async () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'

    const r = reveal(el, { by: 'words', each: 100, duration: 200, scheduler })
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    // word 1 is delayed 100 ms - still at its hidden from-state
    const last = r.split.words[r.split.words.length - 1]!
    expect(Number(last.style.opacity || '0')).toBeLessThan(0.3)

    pump(driver, 8000)
    await r.finished
    for (const word of r.split.words) expect(Number(word.style.opacity)).toBeGreaterThan(0.9)

    r.revert()
    expect(el.innerHTML).toBe('Hello world')
  })

  it('under reduced motion shows the text immediately, no hidden from-state', () => {
    setReducedMotionOverride(true)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'
    const r = reveal(el)
    expect(r.split.words[0]!.style.opacity).not.toBe('0')
    r.revert()
  })
})
