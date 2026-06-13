// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { channelGroup } from '../value/channel-group'
import { formatChannelNumber, type ValueType } from '../value/value-type'
import { bindProperty } from './bind-property'

const pxType: ValueType = {
  parse: () => null,
  format: (channels) => formatChannelNumber(channels[0] ?? 0, { precision: 0 }) + 'px',
  channels: () => [{ precision: 0 }],
}

function setup(initial = 0, shape = 'px') {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const element = document.createElement('div')
  const group = channelGroup(pxType, { channels: [initial], shape }, { scheduler })
  const writes: Array<[string, string]> = []
  vi.spyOn(element.style, 'setProperty').mockImplementation((property, value) => {
    writes.push([property, String(value)])
  })
  return { driver, scheduler, element, group, writes }
}

describe('bindProperty', () => {
  it('writes the current value synchronously at bind time', () => {
    const { element, group, scheduler, writes } = setup(12)
    bindProperty(element, 'width', group, { scheduler })
    expect(writes).toEqual([['width', '12px']])
  })

  it('writes custom properties through setProperty with the -- name intact', () => {
    const { element, group, scheduler, writes } = setup(0.8, '')
    bindProperty(element, '--progress', group, { scheduler })
    expect(writes[0]?.[0]).toBe('--progress')
  })

  it('flushes once per frame from the render phase, then lets the loop sleep', () => {
    const { driver, element, group, scheduler, writes } = setup(0)
    bindProperty(element, 'width', group, { scheduler })
    writes.length = 0

    group.spring({ channels: [100], shape: 'px' })
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    // At most one write per frame (one-shot render flush), and the loop drains.
    expect(writes.length).toBeLessThanOrEqual(2)
    expect(writes.every(([property]) => property === 'width')).toBe(true)

    for (let t = 48; driver.pendingCount() > 0 && t < 6000; t += 16) driver.frame(t)
    expect(driver.pendingCount()).toBe(0)
    expect(group.format()).toBe('100px')
  })

  it('skips the DOM write when the formatted string is byte-identical', () => {
    const { driver, element, group, scheduler, writes } = setup(0)
    bindProperty(element, 'width', group, { scheduler })
    writes.length = 0

    // Sub-precision motion: the value moves 0 -> 0.3 but rounds to 0px every
    // frame, so not a single DOM write is emitted despite the channel animating.
    group.spring({ channels: [0.3], shape: 'px' })
    for (let t = 0; driver.pendingCount() > 0 && t < 6000; t += 16) driver.frame(t)

    expect(writes).toEqual([])
  })

  it('dispose cancels the pending one-shot flush', () => {
    const { driver, element, group, scheduler, writes } = setup(0)
    const binding = bindProperty(element, 'width', group, { scheduler })
    writes.length = 0

    group.spring({ channels: [100], shape: 'px' })
    driver.frame(0)
    driver.frame(16) // a change is now pending a flush
    binding.dispose()
    const before = writes.length
    driver.frame(32)
    expect(writes.length).toBe(before)
  })

  it('flushNow writes synchronously and pre-arms the dedup', () => {
    const { driver, element, group, scheduler, writes } = setup(0)
    const binding = bindProperty(element, 'width', group, { scheduler })
    writes.length = 0

    group.set({ channels: [50], shape: 'px' })
    binding.flushNow()
    expect(writes).toEqual([['width', '50px']]) // synchronous

    // The scheduled flush from the same set() must not rewrite the same value.
    driver.frame(0)
    driver.frame(16)
    expect(writes).toEqual([['width', '50px']])
  })
})
