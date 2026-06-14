import { animatable, createScheduler } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { playable } from '@underlying/core/playback'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createScroll } from './controller'
import { createManualScrollSource } from './source-manual'

const el = {} as HTMLElement

class MockIntersectionObserver {
  static last: MockIntersectionObserver | null = null
  observed: Element[] = []
  constructor(private readonly cb: IntersectionObserverCallback) {
    MockIntersectionObserver.last = this
  }
  observe(target: Element): void {
    this.observed.push(target)
  }
  unobserve(): void {}
  disconnect(): void {
    this.observed = []
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
  emit(isIntersecting: boolean, top: number): void {
    const entry = {
      isIntersecting,
      boundingClientRect: { top, bottom: top + 200 } as DOMRectReadOnly,
      rootBounds: { top: 0, bottom: 1000 } as DOMRectReadOnly,
      target: el,
    } as unknown as IntersectionObserverEntry
    this.cb([entry], this as unknown as IntersectionObserver)
  }
}

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const source = createManualScrollSource({ viewportSize: 1000, maxScroll: 2000 })
  return { driver, scheduler, source, scroll: createScroll({ scheduler, source }) }
}

beforeEach(() => {
  ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = MockIntersectionObserver
})
afterEach(() => {
  delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
  MockIntersectionObserver.last = null
})

describe('trigger', () => {
  it('fires the four direction callbacks from entry geometry', () => {
    const { scroll } = setup()
    const calls: string[] = []
    scroll.trigger(el, {
      onEnter: () => calls.push('enter'),
      onLeave: () => calls.push('leave'),
      onEnterBack: () => calls.push('enterBack'),
      onLeaveBack: () => calls.push('leaveBack'),
    })
    const io = MockIntersectionObserver.last
    if (io === null) throw new Error('observer not created')

    io.emit(true, 900) // enters from the bottom (scrolling down)
    io.emit(false, -200) // exits past the top (scrolling down)
    io.emit(true, -50) // re-enters from the top (scrolling up)
    io.emit(false, 1100) // exits past the bottom (scrolling up)

    expect(calls).toEqual(['enter', 'leave', 'enterBack', 'leaveBack'])
  })

  it('drives the toggle handle via toggleActions', () => {
    const { scheduler, scroll } = setup()
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).to(600, { paused: true })
    scroll.trigger(el, { toggle: handle, toggleActions: ['play', 'pause', 'resume', 'reverse'] })
    const io = MockIntersectionObserver.last
    if (io === null) throw new Error('observer not created')

    io.emit(true, 900) // onEnter -> play
    expect(handle.isPaused()).toBe(false)
    io.emit(false, -200) // onLeave -> pause
    expect(handle.isPaused()).toBe(true)
  })

  it('defaults to play-none-none-none', () => {
    const { scheduler, scroll } = setup()
    const x = animatable(0, { scheduler })
    const handle = playable(x, { scheduler }).to(600, { paused: true })
    scroll.trigger(el, { toggle: handle })
    const io = MockIntersectionObserver.last
    if (io === null) throw new Error('observer not created')

    io.emit(true, 900) // onEnter -> play
    expect(handle.isPaused()).toBe(false)
    io.emit(false, -200) // onLeave -> none, stays playing
    expect(handle.isPaused()).toBe(false)
  })

  it('dispose() disconnects the observer', () => {
    const { scroll } = setup()
    const trig = scroll.trigger(el, { onEnter: () => {} })
    const io = MockIntersectionObserver.last
    if (io === null) throw new Error('observer not created')
    expect(io.observed.length).toBe(1)
    trig.dispose()
    expect(io.observed.length).toBe(0)
  })
})
