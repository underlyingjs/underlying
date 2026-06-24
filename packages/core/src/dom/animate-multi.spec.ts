// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { staggerDelay } from '../compose/stagger-delay'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animate } from './animate'

type Driver = ReturnType<typeof createManualDriver>

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const make = (cls?: string): HTMLElement => {
    const el = document.createElement('div')
    if (cls !== undefined) el.className = cls
    document.body.append(el)
    return el
  }
  return { driver, scheduler, make }
}
const settle = (driver: Driver): void => {
  for (let t = 0; t <= 4000; t += 16) driver.frame(t)
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('animate() multi-target', () => {
  it('drives an array of elements with one handle, all reaching the target', async () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    const handle = animate([a, b], { x: 100 }, { scheduler })
    expect(typeof handle.stop).toBe('function')
    settle(driver)
    await handle.finished
    expect(a.style.transform).toContain('translate3d(100px')
    expect(b.style.transform).toContain('translate3d(100px')
  })

  it('resolves a selector string', async () => {
    const { driver, scheduler, make } = setup()
    make('card')
    make('card')
    const handle = animate('.card', { opacity: 0 }, { scheduler })
    settle(driver)
    await handle.finished
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.card'))) {
      expect(Number(el.style.opacity)).toBeCloseTo(0, 1)
    }
  })

  it('an empty selector match is a no-op handle, not a throw', () => {
    const { scheduler } = setup()
    expect(() => animate('.none', { x: 100 }, { scheduler })).not.toThrow()
  })

  it('a numeric delay staggers the starts on the frame clock', () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    animate([a, b], { x: 100 }, { delay: 200, scheduler })
    driver.frame(0)
    driver.frame(16)
    expect(a.style.transform).not.toBe('') // index 0 starts immediately
    expect(b.style.transform).toBe('') // index 1 still waiting on its 200ms delay
    for (let t = 32; t <= 240; t += 16) driver.frame(t)
    expect(b.style.transform).not.toBe('') // delay elapsed, b has started
  })

  it('a staggerDelay() wave orders starts by the chosen origin', () => {
    const { driver, scheduler, make } = setup()
    const els = [make(), make(), make()]
    // from the last index: index 2 starts first, index 0 last.
    animate(els, { x: 100 }, { delay: staggerDelay({ each: 200, from: 'end' }), scheduler })
    driver.frame(0)
    driver.frame(16)
    expect(els[2]!.style.transform).not.toBe('') // farthest-from-origin == rank 0 == starts now
    expect(els[0]!.style.transform).toBe('') // origin end == rank max == waits longest
  })

  it('applies a per-target function value (index, element, count)', async () => {
    const { driver, scheduler, make } = setup()
    const els = [make(), make(), make()]
    const handle = animate(els, { rotate: (i) => i * 10 }, { scheduler })
    settle(driver)
    await handle.finished
    expect(els[0]!.style.transform).toContain('rotate(0deg)')
    expect(els[2]!.style.transform).toContain('rotate(20deg)')
  })

  it('resolves a relative target against each element live value', async () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    animate(a, { x: 50 }, { scheduler })
    settle(driver)
    const handle = animate([a], { x: '+=100' }, { scheduler })
    settle(driver)
    await handle.finished
    expect(a.style.transform).toContain('translate3d(150px') // 50 + 100
  })

  it('a second call on the set retargets live (one handle, never a restart)', async () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    animate([a, b], { x: 100 }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    const handle = animate([a, b], { x: 300 }, { scheduler })
    settle(driver)
    await handle.finished
    expect(a.style.transform).toContain('translate3d(300px')
    expect(b.style.transform).toContain('translate3d(300px')
  })

  it('fires set-level onInterrupt when a later call supersedes an element', () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    const events: string[] = []
    animate(
      [a, b],
      { x: 100 },
      { scheduler, onComplete: () => events.push('complete'), onInterrupt: () => events.push('interrupt') },
    )
    driver.frame(0)
    driver.frame(16)
    animate([a], { x: 300 }, { scheduler }) // supersedes element a
    settle(driver)
    expect(events).toEqual(['interrupt'])
  })

  it('superseding a still-waiting deferred element fires onInterrupt and does not clobber the new target', async () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    const events: string[] = []
    animate(
      [a, b],
      { x: 100 },
      { delay: 500, scheduler, onComplete: () => events.push('complete'), onInterrupt: () => events.push('interrupt') },
    )
    driver.frame(0)
    driver.frame(16) // a (index 0, delay 0) started; b (index 1, delay 500) still waiting
    const handle = animate([b], { x: 300 }, { scheduler }) // supersede b mid-wait
    settle(driver)
    await handle.finished
    expect(events).toEqual(['interrupt']) // not a false 'complete'
    expect(b.style.transform).toContain('translate3d(300px') // the supersede won, stale 100 dropped
  })

  it('the set stop() freezes every element before its target', () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    const handle = animate([a, b], { x: 400 }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    handle.stop()
    const frozenA = a.style.transform
    const frozenB = b.style.transform
    settle(driver)
    expect(a.style.transform).toBe(frozenA) // no further motion after stop
    expect(b.style.transform).toBe(frozenB)
  })
})
