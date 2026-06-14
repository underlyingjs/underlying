import { describe, expect, it } from 'vitest'
import * as playback from './index'

// The playback entry must be as SSR-safe as the core: importing it touches no
// browser global (the scheduler is lazy, the WAAPI checks live inside animate).
describe('playback SSR import safety', () => {
  it('runs in a DOM-less environment', () => {
    expect(typeof document).toBe('undefined')
    expect(typeof window).toBe('undefined')
  })

  it('exposes the playback surface without touching a browser global at import', () => {
    expect(typeof playback.playable).toBe('function')
    expect(typeof playback.animatePlayback).toBe('function')
    expect(typeof playback.follow).toBe('function')
    expect(typeof playback.timeScope).toBe('function')
    expect(typeof playback.sequence).toBe('function')
  })

  it('constructs a timeScope and a follow value with an injected scheduler, no DOM', () => {
    expect(() => playback.timeScope()).not.toThrow()
    expect(() => playback.sequence()).not.toThrow() // lazy scope: no browser global at construction
    const f = playback.follow(0)
    expect(f.value.get()).toBe(0)
    f.dispose()
  })
})
