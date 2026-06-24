// Runs in the default (node) environment: no document, no HTMLElement, the SSR path.
import { describe, expect, it, vi } from 'vitest'
import { animate } from './animate'

describe('animate (SSR)', () => {
  it('does not throw for a selector or an array target server-side', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(typeof HTMLElement).toBe('undefined')
    // The fast-path guard must not evaluate a bare `instanceof HTMLElement`.
    expect(() => animate('.foo', { x: 100 })).not.toThrow()
    expect(() => animate([], { x: 100 })).not.toThrow()
    vi.restoreAllMocks()
  })
})
