// @vitest-environment jsdom
import { createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 4000 })
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source }) }
}

let element: HTMLElement
beforeEach(() => {
  document.body.innerHTML = ''
  element = document.createElement('div')
  document.body.appendChild(element)
})

describe('pin', () => {
  it('wraps the element in a spacer that reserves the pin span', () => {
    const { source, scroll } = setup()
    source.setBox(element, { start: 1000, size: 500 }) // default range -> enter 0, leave 1500
    const pin = scroll.pin(element) // spacing true: 500 + duration 1500
    const spacer = element.parentElement
    if (spacer === null) throw new Error('no spacer')
    expect(spacer).not.toBe(document.body)
    expect(spacer.style.height).toBe('2000px')
    pin.dispose()
  })

  it('spacing:false reserves only the element size', () => {
    const { source, scroll } = setup()
    source.setBox(element, { start: 1000, size: 500 })
    const pin = scroll.pin(element, { spacing: false })
    expect(element.parentElement?.style.height).toBe('500px')
    pin.dispose()
  })

  it('fixes the element through the range and releases past it', () => {
    const { driver, source, scroll } = setup()
    source.setBox(element, { start: 1000, size: 500 })
    const enters: number[] = []
    const leaves: number[] = []
    scroll.pin(element, { onEnter: () => enters.push(1), onLeave: () => leaves.push(1) })

    const spacer = element.parentElement
    if (spacer === null) throw new Error('no spacer')
    source.setBox(spacer, { start: 1000, size: 500 }) // enter 0, leave 1500
    source.emitResize()
    expect(element.style.position).toBe('') // before the range

    source.emitScroll(750)
    driver.frame(0)
    expect(element.style.position).toBe('fixed') // during
    expect(enters.length).toBe(1)

    source.emitScroll(1600)
    driver.frame(16)
    expect(element.style.position).toBe('absolute') // after
    expect(leaves.length).toBe(1)
  })

  it('exposes pin.track for nested scrubs', () => {
    const { source, scroll } = setup()
    source.setBox(element, { start: 1000, size: 500 })
    const pin = scroll.pin(element)
    const spacer = element.parentElement
    if (spacer === null) throw new Error('no spacer')
    source.setBox(spacer, { start: 1000, size: 500 })
    source.emitResize()

    expect(pin.track.progress()).toBe(0)
    source.emitScroll(750)
    expect(pin.track.progress()).toBe(0.5)
  })

  it('reparent:true moves the node to <body> while pinned, then back', () => {
    const { driver, source, scroll } = setup()
    source.setBox(element, { start: 1000, size: 500 })
    scroll.pin(element, { reparent: true })
    const spacer = element.parentElement
    if (spacer === null) throw new Error('no spacer')
    source.setBox(spacer, { start: 1000, size: 500 })
    source.emitResize()

    source.emitScroll(750)
    driver.frame(0)
    expect(element.parentElement).toBe(document.body) // reparented during

    source.emitScroll(1600)
    driver.frame(16)
    expect(element.parentElement).toBe(spacer) // back in the spacer when released
  })

  it('dispose() unwraps and restores the original DOM', () => {
    const { source, scroll } = setup()
    source.setBox(element, { start: 1000, size: 500 })
    const pin = scroll.pin(element)
    const spacer = element.parentElement
    if (spacer === null) throw new Error('no spacer')

    pin.dispose()
    expect(element.parentElement).toBe(document.body)
    expect(spacer.parentElement).toBe(null)
    expect(element.style.position).toBe('')
  })
})
