// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetReducedMotion, setReducedMotionOverride } from '../a11y/reduced-motion'
import { responsive } from './responsive'

type ChangeListener = (event: { matches: boolean }) => void

function stubMatchMedia() {
  const entries = new Map<string, { matches: boolean; listeners: Set<ChangeListener> }>()
  const entry = (query: string) => {
    let found = entries.get(query)
    if (found === undefined) {
      found = { matches: false, listeners: new Set() }
      entries.set(query, found)
    }
    return found
  }
  vi.stubGlobal('matchMedia', (query: string) => {
    const e = entry(query)
    return {
      get matches() {
        return e.matches
      },
      media: query,
      addEventListener: (_type: string, listener: ChangeListener) => e.listeners.add(listener),
      removeEventListener: (_type: string, listener: ChangeListener) => e.listeners.delete(listener),
    }
  })
  return {
    init(query: string, matches: boolean) {
      entry(query).matches = matches
    },
    set(query: string, matches: boolean) {
      const e = entry(query)
      e.matches = matches
      for (const listener of [...e.listeners]) listener({ matches })
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  __resetReducedMotion()
})

const MQ = '(min-width: 768px)'

describe('responsive', () => {
  it('runs setup on an initial match and teardown when the query stops matching', () => {
    const mm = stubMatchMedia()
    mm.init(MQ, true)
    const events: string[] = []
    const off = responsive(MQ, () => {
      events.push('up')
      return () => events.push('down')
    })
    expect(events).toEqual(['up'])
    mm.set(MQ, false)
    expect(events).toEqual(['up', 'down'])
    mm.set(MQ, true)
    expect(events).toEqual(['up', 'down', 'up'])
    off()
  })

  it('does not run setup when the query does not match initially', () => {
    const mm = stubMatchMedia()
    mm.init(MQ, false)
    const events: string[] = []
    responsive(MQ, () => {
      events.push('up')
    })
    expect(events).toEqual([])
  })

  it('unsubscribe runs a live teardown and stops listening', () => {
    const mm = stubMatchMedia()
    mm.init(MQ, true)
    const events: string[] = []
    const off = responsive(MQ, () => () => events.push('down'))
    off()
    expect(events).toEqual(['down'])
    mm.set(MQ, false) // no longer listening
    expect(events).toEqual(['down'])
  })

  it('the { reducedMotion } form activates via the reduced-motion source (override-aware)', () => {
    setReducedMotionOverride(false)
    const events: string[] = []
    const off = responsive({ reducedMotion: true }, () => {
      events.push('calm')
      return () => events.push('lively')
    })
    expect(events).toEqual([]) // not reduced yet
    setReducedMotionOverride(true)
    expect(events).toEqual(['calm'])
    setReducedMotionOverride(false)
    expect(events).toEqual(['calm', 'lively'])
    off()
  })
})
