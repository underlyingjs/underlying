// Runs in the default (node) environment: no window.matchMedia, the SSR path.
import { describe, expect, it } from 'vitest'
import { responsive } from './responsive'

describe('responsive (SSR)', () => {
  it('never runs setup server-side and the unsubscribe is safe', () => {
    const events: string[] = []
    const off = responsive('(min-width: 768px)', () => {
      events.push('up')
      return () => events.push('down')
    })
    expect(events).toEqual([]) // client-only: no setup without matchMedia
    expect(() => off()).not.toThrow()
    expect(events).toEqual([]) // nothing to tear down
  })

  it('the { reducedMotion: false } form is also client-only (does not run during SSR)', () => {
    const events: string[] = []
    const off = responsive({ reducedMotion: false }, () => {
      events.push('up')
    })
    expect(events).toEqual([]) // would wrongly fire server-side without the client guard
    expect(() => off()).not.toThrow()
  })
})
