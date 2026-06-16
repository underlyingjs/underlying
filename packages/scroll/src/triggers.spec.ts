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

// A minimal element that only needs a working classList for toggleClass tests.
function elWithClass(): HTMLElement {
  const classes = new Set<string>()
  return {
    classList: {
      toggle(name: string, force?: boolean): boolean {
        const on = force === undefined ? !classes.has(name) : force
        if (on) classes.add(name)
        else classes.delete(name)
        return on
      },
      contains: (name: string) => classes.has(name),
      remove: (name: string) => classes.delete(name),
    },
  } as unknown as HTMLElement
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

  it('toggleClass adds the class while intersecting and removes it on leave', () => {
    const { scroll } = setup()
    const element = elWithClass()
    scroll.trigger(element, { toggleClass: 'is-active' })
    const io = MockIntersectionObserver.last
    if (io === null) throw new Error('observer not created')

    io.emit(true, 900) // enter
    expect(element.classList.contains('is-active')).toBe(true)
    io.emit(false, -200) // leave
    expect(element.classList.contains('is-active')).toBe(false)
  })

  it('toggleClass { className, targets } drives other elements (scroll-spy)', () => {
    const { scroll } = setup()
    const link = elWithClass()
    const second = elWithClass()
    scroll.trigger(el, { toggleClass: { className: 'nav-active', targets: [link, second] } })
    const io = MockIntersectionObserver.last
    if (io === null) throw new Error('observer not created')

    io.emit(true, 900) // section enters -> light up its nav links
    expect(link.classList.contains('nav-active')).toBe(true)
    expect(second.classList.contains('nav-active')).toBe(true)
    io.emit(false, 1100) // leaveBack -> dim them
    expect(link.classList.contains('nav-active')).toBe(false)
    expect(second.classList.contains('nav-active')).toBe(false)
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

  it('dispose() strips an active toggleClass so no link stays lit', () => {
    const { scroll } = setup()
    const link = elWithClass()
    const trig = scroll.trigger(el, { toggleClass: { className: 'nav-active', targets: link } })
    const io = MockIntersectionObserver.last
    if (io === null) throw new Error('observer not created')

    io.emit(true, 900) // section in view -> link lit
    expect(link.classList.contains('nav-active')).toBe(true)
    trig.dispose() // teardown must remove the class it added
    expect(link.classList.contains('nav-active')).toBe(false)
  })
})
