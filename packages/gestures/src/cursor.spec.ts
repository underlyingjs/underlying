// @vitest-environment jsdom
import { createScheduler, setReducedMotionOverride } from '@underlying/core'
import { createManualDriver } from '@underlying/core/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cursor } from './cursor'

beforeEach(() => {
  // jsdom ships no matchMedia. Answer only the fine-pointer query - leave
  // prefers-reduced-motion false - and force motion on so the cursor enables.
  window.matchMedia = ((query: string) => ({
    matches: query === '(pointer: fine)',
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  })) as typeof window.matchMedia
  setReducedMotionOverride(false)
})
afterEach(() => {
  setReducedMotionOverride(null)
  document.body.innerHTML = ''
})

const over = (el: Element): void => {
  el.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }))
}

describe('cursor', () => {
  it('creates an element on the body and removes it on dispose', () => {
    const c = cursor({ scheduler: createScheduler(createManualDriver()) })
    expect(c.element.parentElement).toBe(document.body)
    expect(c.element.classList.contains('cursor')).toBe(true)
    expect(c.element.style.pointerEvents).toBe('none')
    c.dispose()
    expect(c.element.parentElement).toBe(null)
  })

  it('flips to the active state over an interactive target', () => {
    const c = cursor({ scheduler: createScheduler(createManualDriver()) })
    const button = document.createElement('button')
    const plain = document.createElement('div')
    document.body.append(button, plain)

    over(button)
    expect(c.element.classList.contains('cursor--active')).toBe(true)
    over(plain)
    expect(c.element.classList.contains('cursor--active')).toBe(false)
    c.dispose()
  })

  it('is hidden and idle under reduced motion', () => {
    setReducedMotionOverride(true)
    const c = cursor({ scheduler: createScheduler(createManualDriver()) })
    expect(c.element.style.display).toBe('none')
    const button = document.createElement('button')
    document.body.append(button)
    over(button)
    expect(c.element.classList.contains('cursor--active')).toBe(false) // not tracking
    c.dispose()
  })

  it('drives a user-provided element without appending or removing it', () => {
    const ring = document.createElement('div')
    const c = cursor({ element: ring, scheduler: createScheduler(createManualDriver()) })
    expect(c.element).toBe(ring)
    expect(ring.style.position).toBe('fixed')
    expect(ring.parentElement).toBe(null) // not owned -> never appended
    c.dispose()
  })
})
