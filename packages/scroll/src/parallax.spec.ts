import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { describe, expect, it } from 'vitest'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

const el = {} as HTMLElement

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
  source.setBox(el, { start: 1000, size: 500 }) // default range -> enter 0, leave 1500
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source }) }
}

describe('parallax', () => {
  it('maps progress to output px (locked)', () => {
    const { driver, source, scroll } = setup()
    const value = scroll.parallax({ target: el, output: [-120, 120] })
    expect(value.get()).toBe(-120) // p 0 at creation -> output[0]

    source.emitScroll(750)
    driver.frame(0)
    expect(value.get()).toBe(0) // p 0.5 -> midpoint

    source.emitScroll(1500)
    driver.frame(16)
    expect(value.get()).toBe(120) // p 1 -> output[1]
  })

  it('re-writes on resize when the box moves under a still scroll', () => {
    const { driver, source, scroll } = setup()
    const value = scroll.parallax({ target: el, output: [0, 100] })
    source.emitScroll(750)
    driver.frame(0)
    expect(value.get()).toBe(50)

    // box moves up; the same scrollPos now sits past the range -> p clamps to 1
    source.setBox(el, { start: 0, size: 500 })
    source.emitResize()
    expect(value.get()).toBe(100) // re-written with no scroll movement
  })

  it('smooths the output through a follow() (momentum)', () => {
    const { driver, source, scroll } = setup()
    const value = scroll.parallax({ target: el, output: [0, 100], smooth: 0.1 })

    source.emitScroll(1500) // aim at 100
    driver.frame(0) // sets the follow target; follow wakes
    driver.frame(16) // integrates a step
    const v1 = value.get()
    expect(v1).toBeGreaterThan(0)
    expect(v1).toBeLessThan(100)

    for (let t = 32; t <= 1600; t += 16) driver.frame(t)
    expect(value.get()).toBeCloseTo(100, 1)
  })

  it('dispose() freezes the value', () => {
    const { driver, source, scroll } = setup()
    const value = scroll.parallax({ target: el, output: [0, 100] })
    source.emitScroll(750)
    driver.frame(0)
    expect(value.get()).toBe(50)

    value.dispose()
    source.emitScroll(1500)
    driver.frame(16)
    expect(value.get()).toBe(50) // no further movement
  })
})
