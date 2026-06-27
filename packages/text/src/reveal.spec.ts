// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver, type ManualDriver } from '@underlying/core/testing'
import { reveal } from './reveal'

const pump = (driver: ManualDriver, toMs: number, step = 16): void => {
  for (let t = 0; t <= toMs; t += step) driver.frame(t)
}

// jsdom has no layout: stub offsetHeight (the mask hide offset) so it is non-zero.
function stubOffsetHeight(px: number): () => void {
  const prev = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => px })
  return () => {
    if (prev) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', prev)
    else delete (HTMLElement.prototype as unknown as { offsetHeight?: number }).offsetHeight
  }
}

function fakeResizeObserver() {
  let callback: ResizeObserverCallback | null = null
  class FakeRO {
    constructor(cb: ResizeObserverCallback) {
      callback = cb
    }
    observe(): void {}
    disconnect(): void {}
  }
  vi.stubGlobal('ResizeObserver', FakeRO)
  return {
    fire(width: number): void {
      callback?.([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver)
    },
  }
}

afterEach(() => {
  setReducedMotionOverride(null)
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

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

  it('mask:true wraps words in inline-block clip masks (aria-hidden), spacing preserved', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'
    const r = reveal(el, { by: 'words', mask: true, scheduler })

    const word = el.querySelector('.u-text__word') as HTMLElement
    const wrapper = word.parentElement!
    expect(wrapper.className).toBe('u-text__mask')
    expect(wrapper.style.overflow).toBe('hidden')
    expect(wrapper.style.display).toBe('inline-block')
    expect(wrapper.style.verticalAlign).toBe('top')
    expect(wrapper.getAttribute('aria-hidden')).toBe('true')
    // the inter-word whitespace stays a sibling of the wrappers (outside the clip)
    expect(el.querySelector('.u-text')!.textContent).toContain(' ')
    r.revert()
    expect(el.innerHTML).toBe('Hello world')
  })

  it('mask line wrappers are block; char masks sit inside the word', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const lineEl = document.createElement('h2')
    lineEl.textContent = 'One two'
    reveal(lineEl, { by: 'lines', mask: true, scheduler })
    const line = lineEl.querySelector('.u-text__line') as HTMLElement
    expect(line.parentElement!.className).toBe('u-text__mask')
    expect(line.parentElement!.style.display).toBe('block')
    expect(line.parentElement!.style.verticalAlign).toBe('') // block wrappers are not re-baselined

    const charEl = document.createElement('h2')
    charEl.textContent = 'Hi'
    reveal(charEl, { by: 'chars', mask: true, scheduler })
    const char = charEl.querySelector('.u-text__char') as HTMLElement
    const charMask = char.parentElement!
    expect(charMask.className).toBe('u-text__mask')
    expect(charMask.parentElement!.className).toBe('u-text__word') // mask is inside the word
  })

  it('a11y "off" leaves the mask wrappers readable (no aria-hidden)', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'
    reveal(el, { by: 'words', mask: true, a11y: 'off', scheduler })
    expect(el.querySelector('.u-text__mask')!.getAttribute('aria-hidden')).toBeNull()
  })

  it('reduced motion makes no mask wrappers and no offset', () => {
    setReducedMotionOverride(true)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'
    const r = reveal(el, { by: 'lines', mask: true })
    expect(el.querySelector('.u-text__mask')).toBeNull()
    expect(r.split.words[0]!.style.transform || '').not.toContain('px')
    r.revert()
  })

  it('mask hides each piece by its measured height, then springs it to y:0', async () => {
    const restore = stubOffsetHeight(20)
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'
    const r = reveal(el, { by: 'words', mask: true, each: 0, duration: 200, scheduler })

    const word = r.split.words[0]!
    expect(word.style.transform).toContain('21px') // started hidden below the edge (offsetHeight 20 + 1 over-hide)
    pump(driver, 4000)
    await r.finished
    expect(word.style.transform).toContain('translate3d(0px, 0px') // risen to rest
    restore()
    r.revert()
  })

  it('a plain reveal is unchanged: no mask wrappers, no resize observer', () => {
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'
    const r = reveal(el, { by: 'lines', scheduler })
    expect(el.querySelector('.u-text__mask')).toBeNull()
    r.revert()
  })

  it('a re-split after the reveal settled leaves the new line masks settled, not re-hidden', async () => {
    vi.useFakeTimers()
    const ro = fakeResizeObserver()
    const restore = stubOffsetHeight(20)
    const driver = createManualDriver()
    const scheduler = createScheduler(driver)
    const el = document.createElement('h1')
    el.textContent = 'Hello world'
    el.getBoundingClientRect = () => ({ width: 50 }) as DOMRect

    const r = reveal(el, { by: 'lines', mask: true, each: 0, duration: 100, scheduler })
    pump(driver, 4000)
    await r.finished

    ro.fire(140) // width change -> split re-splits -> reveal handleResplit
    vi.advanceTimersByTime(200)

    const line = el.querySelector('.u-text__line') as HTMLElement
    expect(line.parentElement!.className).toBe('u-text__mask') // re-wrapped
    expect(line.style.transform).toContain('translate3d(0px, 0px') // snapped to rest, not re-hidden at 20px
    restore()
    r.revert()
  })
})
