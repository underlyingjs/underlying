import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it, vi } from 'vitest'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

const el = {} as HTMLElement

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
  source.setBox(el, { start: 1000, size: 500 })
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source }) }
}

describe('createScroll', () => {
  it('samples a registered track when scroll moves', () => {
    const { driver, source, scroll } = setup()
    const track = scroll.track({ target: el })
    const seen = vi.fn()
    track.on(seen)

    source.emitScroll(750)
    driver.frame(0)
    expect(track.progress()).toBe(0.5)
    expect(seen).toHaveBeenLastCalledWith(0.5)
  })

  it('runs one loop and sleeps it when scrolling stops', () => {
    const { driver, source, scroll } = setup()
    scroll.track({ target: el })

    source.emitScroll(750)
    driver.frame(0) // samples
    expect(driver.pendingCount()).toBe(1) // still awake right after a sample
    driver.frame(16) // nothing new -> loop sleeps
    expect(driver.pendingCount()).toBe(0)
  })

  it('exposes whole-scroller progress()', () => {
    const { source, scroll } = setup()
    source.emitScroll(1000)
    expect(scroll.progress()).toBe(0.5) // 1000 / maxScroll 2000
  })

  it('refresh() re-measures every track', () => {
    const { source, scroll } = setup()
    const track = scroll.track({ target: el })
    source.emitScroll(750)
    expect(track.progress()).toBe(0.5)

    source.setBox(el, { start: 0, size: 500 })
    scroll.refresh()
    expect(track.progress()).toBe(1)
  })

  it('dispose() tears down the loop and the tracks', () => {
    const { driver, source, scroll } = setup()
    scroll.track({ target: el })
    source.emitScroll(750)
    scroll.dispose()
    expect(driver.pendingCount()).toBe(0)
  })
})
