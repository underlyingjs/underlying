// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linear } from '../physics/easings'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { __resetWarnings } from '../value/warn'
import { animatePlayback } from './animate'

interface FakeAnimation {
  keyframes: Array<Record<string, string>>
  options: Record<string, unknown>
  currentTime: number
  cancelled: boolean
  paused: boolean
  playbackRate: number
  onfinish: (() => void) | null
  cancel(): void
  pause(): void
  play(): void
}

function setupWaapi() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const element = document.createElement('div')
  vi.stubGlobal('CSS', { supports: () => true })
  const animations: FakeAnimation[] = []
  Object.defineProperty(element, 'animate', {
    value: (keyframes: Array<Record<string, string>>, options: Record<string, unknown>) => {
      const animation: FakeAnimation = {
        keyframes,
        options,
        currentTime: 0,
        cancelled: false,
        paused: false,
        playbackRate: 1,
        onfinish: null,
        cancel() {
          this.cancelled = true
        },
        pause() {
          this.paused = true
        },
        play() {
          this.paused = false
        },
      }
      animations.push(animation)
      return animation
    },
  })
  return { driver, scheduler, element, animations }
}

const translateX = (element: HTMLElement): number =>
  Number(/translate3d\((-?[\d.]+)px/.exec(element.style.transform)?.[1] ?? Number.NaN)

afterEach(() => {
  vi.unstubAllGlobals()
  __resetWarnings()
})

describe('animatePlayback - delegated tween', () => {
  it('routes every control onto the native WAAPI animation', () => {
    const { scheduler, element, animations } = setupWaapi()
    const h = animatePlayback(element, { x: 100 }, { duration: 1000, easing: linear, scheduler })
    const animation = animations[0]!

    expect(h.kind).toBe('timeline')
    expect(h.seekable).toBe(true)

    h.pause()
    expect(animation.paused).toBe(true)
    expect(h.isPaused()).toBe(true)
    h.play()
    expect(animation.paused).toBe(false)

    h.timeScale(2)
    expect(animation.playbackRate).toBe(2)
    expect(h.timeScale()).toBe(2)

    h.seek(250)
    expect(animation.currentTime).toBe(250)
    expect(h.progress()).toBeCloseTo(0.25, 6)
    h.progress(0.5)
    expect(animation.currentTime).toBe(500)

    h.reverse()
    expect(animation.playbackRate).toBe(-2)
  })

  it('starts paused when asked', () => {
    const { scheduler, element, animations } = setupWaapi()
    animatePlayback(element, { x: 100 }, { duration: 1000, paused: true, scheduler })
    expect(animations[0]!.paused).toBe(true)
  })

  it('reverses then reclaims with a negated handoff velocity', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    const h = animatePlayback(element, { x: 100 }, { duration: 1000, easing: linear, scheduler })

    animations[0]!.currentTime = 320 // linear 0->100 over 1 s: position 32, forward velocity +100
    h.reverse()
    expect(animations[0]!.playbackRate).toBe(-1)

    // Interrupting with a spring reclaims from the curve, now with -100 u/s.
    void animatePlayback(element, { x: 0 }, { scheduler })
    driver.frame(0)
    expect(translateX(element)).toBeCloseTo(32, 5)

    driver.frame(16)
    expect(translateX(element)).toBeLessThan(32) // negated velocity drives it down, not up
  })
})

describe('animatePlayback - JS path (spring)', () => {
  it('pauses and resumes through the private timeScope', () => {
    const { driver, scheduler, element } = setupWaapi()
    const h = animatePlayback(element, { x: 100 }, { scheduler }) // spring, no duration
    expect(h.kind).toBe('physics')
    expect(h.seekable).toBe(false)

    driver.frame(0)
    driver.frame(16)
    const frozen = translateX(element)
    expect(frozen).toBeGreaterThan(0)

    h.pause()
    expect(driver.pendingCount()).toBe(0) // loop asleep
    driver.frame(32)
    driver.frame(48)
    expect(translateX(element)).toBe(frozen)

    h.play()
    driver.frame(64)
    driver.frame(80)
    expect(translateX(element)).not.toBe(frozen)
  })

  it('warns once and no-ops on seek / progress', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { scheduler, element } = setupWaapi()
    const h = animatePlayback(element, { x: 100 }, { scheduler })

    h.seek(100)
    h.progress(0.5)
    expect(warn).toHaveBeenCalledTimes(1) // one shared key
  })
})
