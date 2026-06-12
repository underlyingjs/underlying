// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetReducedMotion,
  onReducedMotionChange,
  prefersReducedMotion,
  setReducedMotionOverride,
} from './reduced-motion'

type ChangeListener = (event: { matches: boolean }) => void

function stubMatchMedia(initial: boolean) {
  const listeners = new Set<ChangeListener>()
  const mql = {
    matches: initial,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_type: string, listener: ChangeListener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: ChangeListener) => {
      listeners.delete(listener)
    },
  }
  vi.stubGlobal('matchMedia', () => mql)
  return {
    set(matches: boolean) {
      mql.matches = matches
      for (const listener of [...listeners]) listener({ matches })
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  __resetReducedMotion()
})

describe('prefersReducedMotion', () => {
  it('reads the media query', () => {
    stubMatchMedia(true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('tracks mid-session changes', () => {
    const media = stubMatchMedia(false)
    expect(prefersReducedMotion()).toBe(false)
    media.set(true)
    expect(prefersReducedMotion()).toBe(true)
    media.set(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('setReducedMotionOverride', () => {
  it('forces the preference regardless of the OS, null returns to the OS', () => {
    stubMatchMedia(false)
    setReducedMotionOverride(true)
    expect(prefersReducedMotion()).toBe(true)

    setReducedMotionOverride(null)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('can force the preference OFF despite the OS', () => {
    stubMatchMedia(true)
    setReducedMotionOverride(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('notifies subscribers only when the effective value changes', () => {
    const media = stubMatchMedia(false)
    const seen: boolean[] = []
    onReducedMotionChange((reduced) => seen.push(reduced))

    setReducedMotionOverride(true) // effectif : false -> true
    media.set(true) // masqué par l'override : pas de notification
    setReducedMotionOverride(null) // retour à l'OS (true) : pas de changement effectif
    media.set(false) // effectif : true -> false
    expect(seen).toEqual([true, false])
  })
})

describe('onReducedMotionChange', () => {
  it('notifies listeners and supports unsubscribe', () => {
    const media = stubMatchMedia(false)
    const seen: boolean[] = []
    const unsubscribe = onReducedMotionChange((reduced) => seen.push(reduced))

    media.set(true)
    media.set(false)
    unsubscribe()
    media.set(true)
    expect(seen).toEqual([true, false])
  })
})
