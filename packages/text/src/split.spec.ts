// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { split, type Split } from './split'

// A controllable ResizeObserver: captures the callback so a test can fire a width change.
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('split', () => {
  it('splits into words, keeps a readable copy, hides the pieces, and reverts losslessly', () => {
    const el = document.createElement('h1')
    el.textContent = 'Hello world'

    const s = split(el)
    expect(s.words.map((w) => w.textContent)).toEqual(['Hello', 'world'])

    // children[0] = visually-hidden readable copy (a11y + copy/paste); children[1] = the aria-hidden pieces
    expect(el.children.length).toBe(2)
    expect(el.children[0]!.textContent).toBe('Hello world')
    expect(el.children[1]!.getAttribute('aria-hidden')).toBe('true')

    s.revert()
    expect(el.innerHTML).toBe('Hello world')
    expect(el.querySelector('.u-text')).toBeNull()
  })

  it('splits into graphemes, leaving spaces as un-wrapped text', () => {
    const el = document.createElement('div')
    el.textContent = 'Hi 😀'
    const s = split(el, { type: ['chars'] })
    expect(s.chars.map((c) => c.textContent)).toEqual(['H', 'i', '😀'])
  })

  it('a11y "label" mode sets and reverts aria-label', () => {
    const el = document.createElement('div')
    el.textContent = 'Save'
    const s = split(el, { a11y: 'label' })
    expect(el.getAttribute('aria-label')).toBe('Save')
    s.revert()
    expect(el.getAttribute('aria-label')).toBeNull()
  })

  it('onResplit fires after a re-split, never on the initial build or after revert', () => {
    vi.useFakeTimers()
    const ro = fakeResizeObserver()
    const el = document.createElement('h1')
    el.textContent = 'Hello there world'
    el.getBoundingClientRect = () => ({ width: 50 }) as DOMRect // initial lastWidth

    const calls: Split[] = []
    const s = split(el, { type: ['words', 'lines'], onResplit: (sp) => calls.push(sp) })
    expect(calls).toHaveLength(0) // not on the initial split

    ro.fire(140) // a width change
    vi.advanceTimersByTime(200) // debounce
    expect(calls).toHaveLength(1)
    expect(calls[0]).toBe(s) // the same Split, arrays repopulated

    s.revert()
    ro.fire(220)
    vi.advanceTimersByTime(200)
    expect(calls).toHaveLength(1) // never after revert (the reverted guard)
  })
})
