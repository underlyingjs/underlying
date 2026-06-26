// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { bindTemplate, template } from './bind-template'

type Driver = ReturnType<typeof createManualDriver>

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const element = document.createElement('div')
  const writes: Array<[string, string]> = []
  vi.spyOn(element.style, 'setProperty').mockImplementation((property, value) => {
    writes.push([property, String(value)])
  })
  return { driver, scheduler, element, writes }
}
const settle = (driver: Driver): void => {
  for (let t = 0; driver.pendingCount() > 0 && t < 6000; t += 16) driver.frame(t)
}

describe('bindTemplate / template', () => {
  it('writes the composed string synchronously at bind time', () => {
    const { scheduler, element, writes } = setup()
    const blur = animatable(0, { scheduler })
    const glow = animatable(1, { scheduler })
    bindTemplate(element, 'filter', template`blur(${blur}px) brightness(${glow})`, { scheduler })
    expect(writes).toEqual([['filter', 'blur(0px) brightness(1)']])
  })

  it('writes to a custom property with the -- name intact', () => {
    const { scheduler, element, writes } = setup()
    const angle = animatable(45, { scheduler })
    bindTemplate(element, '--angle', template`${angle}deg`, { scheduler })
    expect(writes[0]).toEqual(['--angle', '45deg'])
  })

  it('collapses N source changes in a frame into one write', () => {
    const { driver, scheduler, element, writes } = setup()
    const blur = animatable(0, { scheduler })
    const glow = animatable(1, { scheduler })
    bindTemplate(element, 'filter', template`blur(${blur}px) brightness(${glow})`, { scheduler })
    writes.length = 0

    blur.spring(10)
    glow.spring(2)
    driver.frame(0)
    driver.frame(16)
    // Two sources changing collapse to ONE render flush per frame (not one each):
    // without fan-in batching this would be up to 4 writes across two frames.
    expect(writes.length).toBeLessThanOrEqual(2)
    expect(writes.length).toBeGreaterThanOrEqual(1)
    expect(writes.every(([property]) => property === 'filter')).toBe(true)
    settle(driver)
    const last = writes[writes.length - 1]?.[1] ?? ''
    expect(last).toContain('blur(10px)')
    expect(last).toContain('brightness(2)')
  })

  it('writes nothing while idle', () => {
    const { driver, scheduler, element, writes } = setup()
    const blur = animatable(4, { scheduler })
    bindTemplate(element, 'filter', template`blur(${blur}px)`, { scheduler })
    writes.length = 0
    for (let t = 0; t <= 200; t += 16) driver.frame(t)
    expect(writes).toEqual([])
  })

  it('skips the write when sub-precision motion rounds identically', () => {
    const { driver, scheduler, element, writes } = setup()
    const blur = animatable(0, { scheduler })
    bindTemplate(element, 'filter', template`blur(${blur}px)`, { scheduler }) // precision 4
    writes.length = 0
    blur.spring(0.00001) // rounds to 0 every frame
    settle(driver)
    expect(writes).toEqual([])
  })

  it('folds constants into the literal and does not subscribe to them', () => {
    const { scheduler, element, writes } = setup()
    const blur = animatable(0, { scheduler })
    const tpl = template`brightness(${1.2}) blur(${blur}px)`
    expect(tpl.sources).toHaveLength(1) // only blur is a live source
    bindTemplate(element, 'filter', tpl, { scheduler })
    expect(writes[0]?.[1]).toBe('brightness(1.2) blur(0px)')
  })

  it('unwraps a follow()-style { value } to the same animatable', () => {
    const { scheduler } = setup()
    const a = animatable(5, { scheduler })
    const follow = { value: a }
    expect(template`x(${follow})`.sources[0]).toBe(a)
    expect(template`x(${follow})`.sources).toEqual(template`x(${a})`.sources)
  })

  it('subscribes once to a source used in two slots, but renders it in both', () => {
    const { scheduler, element, writes } = setup()
    const a = animatable(3, { scheduler })
    const onSpy = vi.spyOn(a, 'on')
    bindTemplate(element, 'transform', template`translate(${a}px, ${a}px)`, { scheduler })
    expect(onSpy).toHaveBeenCalledTimes(1) // deduped fan-in
    expect(writes[0]?.[1]).toBe('translate(3px, 3px)') // appears twice
  })

  it('dispose() tears down the sources so a later change writes nothing', () => {
    const { driver, scheduler, element, writes } = setup()
    const blur = animatable(0, { scheduler })
    const dispose = bindTemplate(element, 'filter', template`blur(${blur}px)`, { scheduler })
    writes.length = 0
    dispose()
    blur.spring(50)
    settle(driver)
    expect(writes).toEqual([])
  })

  it('the function form spreads raw numbers, arity-matched to the sources', () => {
    const { driver, scheduler, element, writes } = setup()
    const x = animatable(10, { scheduler })
    const y = animatable(20, { scheduler })
    bindTemplate(element, 'transform', [x, y], (px, py) => `translate3d(${px}px, ${py}px, 0)`, { scheduler })
    expect(writes[0]?.[1]).toBe('translate3d(10px, 20px, 0)')
    writes.length = 0
    x.set(30)
    driver.frame(0)
    expect(writes[writes.length - 1]?.[1]).toBe('translate3d(30px, 20px, 0)')
  })

  it('formats a non-finite source value as 0, never NaN or Infinity', () => {
    const { scheduler, element, writes } = setup()
    const b = animatable(Infinity, { scheduler })
    bindTemplate(element, 'filter', template`blur(${b}px)`, { scheduler })
    expect(writes[0]?.[1]).toBe('blur(0px)') // not 'blur(Infinitypx)'
  })

  it('honors the precision option (default 4)', () => {
    const a = setup()
    const value = animatable(1.23456, { scheduler: a.scheduler })
    bindTemplate(a.element, 'filter', template`brightness(${value})`, { scheduler: a.scheduler, precision: 2 })
    expect(a.writes[0]?.[1]).toBe('brightness(1.23)')

    const b = setup()
    const value2 = animatable(1.23456, { scheduler: b.scheduler })
    bindTemplate(b.element, 'filter', template`brightness(${value2})`, { scheduler: b.scheduler })
    expect(b.writes[0]?.[1]).toBe('brightness(1.2346)') // default 4 decimals
  })
})
