import { describe, expect, it } from 'vitest'
import { createScroll } from './controller'

// Default 'node' environment: no window/document. Proves nothing touches
// browser globals at import or construction; the DOM source is lazy.
describe('SSR safety', () => {
  it('runs with no DOM present', () => {
    expect(typeof window).toBe('undefined')
  })

  it('constructs and disposes without instantiating the DOM source', () => {
    const scroll = createScroll()
    expect(scroll).toBeDefined()
    expect(() => scroll.dispose()).not.toThrow() // no source ever created
  })

  it('accepts options without reading the DOM', () => {
    expect(() => createScroll({ axis: 'x' }).dispose()).not.toThrow()
  })
})
