// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { region } from './region'

type Driver = ReturnType<typeof createManualDriver>
const settle = (driver: Driver): void => {
  for (let t = 0; t <= 4000; t += 16) driver.frame(t)
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('region', () => {
  it('stops and releases a tracked animation on revert()', async () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('div')
    document.body.append(el)
    const r = region()
    const handle = r.animate(el, { x: 100 }, { scheduler })
    settle(driver)
    await handle.finished
    expect(el.style.transform).toContain('translate3d(100px') // wrote inline transform
    r.revert()
    expect(el.style.transform).toBe('') // releaseStyle removed the inline transform
  })

  it('revert() is idempotent', () => {
    const r = region()
    let count = 0
    r.add(() => {
      count += 1
    })
    r.revert()
    r.revert()
    expect(count).toBe(1)
  })

  it('runs disposers in LIFO order', () => {
    const order: number[] = []
    const r = region()
    r.add(() => order.push(1))
    r.add(() => order.push(2))
    r.add(() => order.push(3))
    r.revert()
    expect(order).toEqual([3, 2, 1])
  })

  it('add() and track() return their argument unchanged', () => {
    const r = region()
    const fn = (): void => {}
    expect(r.add(fn)).toBe(fn)
    const finished = Promise.resolve()
    const handle = { finished, then: finished.then.bind(finished), stop: () => {} }
    expect(r.track(handle)).toBe(handle)
  })

  it('runs a setup callback with the region', () => {
    let received: unknown = null
    const r = region((scope) => {
      received = scope
    })
    expect(received).toBe(r)
  })

  it('stops a tracked external handle on revert()', () => {
    let stopped = false
    const r = region()
    const finished = Promise.resolve()
    r.track({ finished, then: finished.then.bind(finished), stop: () => (stopped = true) })
    r.revert()
    expect(stopped).toBe(true)
  })

  it('isolates a throwing disposer so the rest of revert() still runs', () => {
    const el = document.createElement('div')
    document.body.append(el)
    el.style.transform = 'translate3d(5px, 0px, 0)'
    const order: string[] = []
    const r = region()
    r.setStyle(el, { x: 5 }) // marks el as touched
    r.add(() => order.push('early'))
    r.add(() => {
      throw new Error('boom')
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => r.revert()).not.toThrow()
    err.mockRestore()
    expect(order).toEqual(['early']) // LIFO: boom threw first, early still ran
    expect(el.style.transform).toBe('') // releaseStyle still ran despite the throw
  })
})
