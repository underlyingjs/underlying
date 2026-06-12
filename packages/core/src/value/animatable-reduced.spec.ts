// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionBehavior } from '../a11y/config'
import { __resetReducedMotion } from '../a11y/reduced-motion'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from './animatable'

type ChangeListener = (event: { matches: boolean }) => void

function stubReducedMotion(initial: boolean) {
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

function setup(initial = 0) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const value = animatable(initial, { scheduler })
  return { driver, scheduler, value }
}

afterEach(() => {
  vi.unstubAllGlobals()
  __resetReducedMotion()
  setReducedMotionBehavior('skip')
})

describe('animatable under prefers-reduced-motion (zéro configuration)', () => {
  it('a spring jumps straight to its target', async () => {
    stubReducedMotion(true)
    const { driver, value } = setup(0)
    const onRest = vi.fn()
    value.on('rest', onRest)

    const handle = value.spring(100)
    expect(value.get()).toBe(100)
    expect(value.velocity()).toBe(0)
    expect(value.isAnimating()).toBe(false)
    expect(onRest).toHaveBeenCalledTimes(1)
    expect(driver.pendingCount()).toBe(0) // la boucle n'a jamais été réveillée
    await handle.finished
  })

  it('a decay lands exactly where the full glide would have ended', () => {
    stubReducedMotion(true)
    const { value } = setup(0)
    value.decay({ velocity: 1000, timeConstant: 325 })
    expect(value.get()).toBeCloseTo(1000 * (0.325 - 1 / 120), 0) // distance discrète v0*(tau-h)
  })

  it('a decay with a boundary lands exactly on the edge', () => {
    stubReducedMotion(true)
    const { value } = setup(0)
    value.decay({ velocity: 2000, timeConstant: 500, max: 100 })
    expect(value.get()).toBe(100)
  })

  it('a tween jumps straight to its target', () => {
    stubReducedMotion(true)
    const { value } = setup(0)
    value.to(100, { duration: 400 })
    expect(value.get()).toBe(100)
    expect(value.isAnimating()).toBe(false)
  })

  it("per-animation 'allow' opts out (essential motion, e.g. gesture-driven)", () => {
    stubReducedMotion(true)
    const { driver, value } = setup(0)
    value.spring(100, { reducedMotion: 'allow' })
    expect(value.isAnimating()).toBe(true)

    driver.frame(0)
    driver.frame(16)
    expect(value.get()).toBeGreaterThan(0)
    expect(value.get()).toBeLessThan(100)
  })

  it("global 'allow' disables the reduction entirely", () => {
    stubReducedMotion(true)
    setReducedMotionBehavior('allow')
    const { value } = setup(0)
    value.spring(100)
    expect(value.isAnimating()).toBe(true)
  })

  it('new animations react to a mid-session toggle', () => {
    const media = stubReducedMotion(false)
    const { value } = setup(0)
    value.spring(100)
    expect(value.isAnimating()).toBe(true) // préférence inactive : animation normale
    value.stop()

    media.set(true)
    value.spring(50)
    expect(value.isAnimating()).toBe(false) // préférence activée en cours de session
    expect(value.get()).toBe(50)
  })
})
