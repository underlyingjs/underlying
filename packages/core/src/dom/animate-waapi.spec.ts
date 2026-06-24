// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linear } from '../physics/easings'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animate } from './animate'

interface FakeAnimation {
  keyframes: Array<Record<string, string>>
  options: Record<string, unknown>
  currentTime: number
  cancelled: boolean
  onfinish: (() => void) | null
  cancel(): void
}

function setupWaapi(linearSupported = true) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const element = document.createElement('div')
  vi.stubGlobal('CSS', { supports: () => linearSupported })
  const animations: FakeAnimation[] = []
  Object.defineProperty(element, 'animate', {
    value: (keyframes: Array<Record<string, string>>, options: Record<string, unknown>) => {
      const animation: FakeAnimation = {
        keyframes,
        options,
        currentTime: 0,
        cancelled: false,
        onfinish: null,
        cancel() {
          this.cancelled = true
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
})

describe('animate - délégation WAAPI opportuniste', () => {
  it('delegates an eligible tween (duration + transform/opacity) and leaves the loop asleep', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { x: 100, opacity: 0 }, { duration: 500, easing: linear, scheduler })

    expect(animations.length).toBe(1)
    const [animation] = animations
    expect(animation!.keyframes[0]!['transform']).toBe('translate3d(0px, 0px, 0)')
    expect(animation!.keyframes[1]!['transform']).toBe('translate3d(100px, 0px, 0)')
    expect(animation!.keyframes[0]!['opacity']).toBe('1')
    expect(animation!.keyframes[1]!['opacity']).toBe('0')
    expect(animation!.options['duration']).toBe(500)
    expect(String(animation!.options['easing']).startsWith('linear(')).toBe(true)
    expect(animation!.options['fill']).toBe('forwards')
    expect(driver.pendingCount()).toBe(0) // le compositor travaille, pas notre boucle
  })

  it('delegates transform-origin as its own keyframe property, alongside transform', () => {
    const { element, animations, scheduler } = setupWaapi()
    animate(element, { originX: 0, originY: 100, rotateY: 180 }, { duration: 400, easing: linear, scheduler })

    expect(animations.length).toBe(1)
    const [animation] = animations
    expect(animation!.keyframes[0]!['transformOrigin']).toBe('50% 50%') // from the CSS-neutral center
    expect(animation!.keyframes[1]!['transformOrigin']).toBe('0% 100%')
    expect(animation!.keyframes[0]!['transform']).toBe('rotateY(0deg)')
    expect(animation!.keyframes[1]!['transform']).toBe('rotateY(180deg)')
  })

  it('never delegates springs - physics stays on the rAF loop', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { x: 100 }, { scheduler })

    expect(animations.length).toBe(0)
    expect(driver.pendingCount()).toBe(1)
  })

  it('commits exact final values, then cancels WAAPI after the render flush', async () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    const handle = animate(element, { x: 100, opacity: 0 }, { duration: 500, scheduler })

    animations[0]!.onfinish?.()
    expect(animations[0]!.cancelled).toBe(false) // pas avant l'écriture du style

    driver.frame(0)
    expect(element.style.transform).toBe('translate3d(100px, 0px, 0)')
    expect(element.style.opacity).toBe('0')
    expect(animations[0]!.cancelled).toBe(true)
    expect(driver.pendingCount()).toBe(0)
    await handle.finished
  })

  it('interruption mid-flight reclaims position AND velocity from the curve', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { x: 100 }, { duration: 1000, easing: linear, scheduler })

    animations[0]!.currentTime = 320 // linéaire 0->100 en 1 s : position 32, vélocité 100 u/s
    animate(element, { x: 0 }, { scheduler }) // spring interrupteur

    expect(animations[0]!.cancelled).toBe(true)
    driver.frame(0)
    expect(translateX(element)).toBeCloseTo(32, 5) // position récupérée de la courbe

    driver.frame(16)
    // La vélocité héritée (+100 u/s) pousse d'abord la valeur AU-DELÀ de 32,
    // alors que la cible du spring est 0 : c'est la conservation de vélocité.
    expect(translateX(element)).toBeGreaterThan(32)
    expect(translateX(element)).toBeLessThan(36)

    for (let t = 32; t <= 6000; t += 16) driver.frame(t)
    expect(element.style.transform).toBe('translate3d(0px, 0px, 0)')
  })

  it('stop() during delegation freezes on the current curve point', async () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    const handle = animate(element, { x: 100 }, { duration: 1000, easing: linear, scheduler })

    animations[0]!.currentTime = 500
    handle.stop()
    expect(animations[0]!.cancelled).toBe(true)

    driver.frame(0)
    expect(translateX(element)).toBeCloseTo(50, 5)
    for (let t = 16; t <= 200; t += 16) driver.frame(t)
    expect(translateX(element)).toBeCloseTo(50, 5) // gelé
    expect(driver.pendingCount()).toBe(0)
    await handle.finished
  })

  it('falls back to the rAF tween when linear() easing is unsupported', () => {
    const { driver, scheduler, element, animations } = setupWaapi(false)
    animate(element, { x: 100 }, { duration: 480, easing: linear, scheduler })

    expect(animations.length).toBe(0)
    expect(driver.pendingCount()).toBe(1) // la boucle prend le relais
    for (let t = 0; t <= 800; t += 16) driver.frame(t)
    expect(translateX(element)).toBe(100)
  })

  it('does not delegate while another channel is mid-physics on the element', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { y: 50 }, { scheduler }) // spring en cours
    driver.frame(0)
    driver.frame(16)

    animate(element, { x: 100 }, { duration: 300, scheduler })
    expect(animations.length).toBe(0) // conflit transform : pas de délégation
  })
})

describe('animate - WAAPI multi-keyframe delegation', () => {
  it('delegates an n-keyframe numeric array as n keyframes with easing on 0..n-2', () => {
    const { scheduler, element, animations } = setupWaapi()
    animate(element, { x: [0, 100, 50] }, { duration: 900, easing: linear, scheduler })

    expect(animations.length).toBe(1)
    const { keyframes, options } = animations[0]!
    expect(keyframes.length).toBe(3)
    expect(keyframes[0]!['transform']).toBe('translate3d(0px, 0px, 0)')
    expect(keyframes[1]!['transform']).toBe('translate3d(100px, 0px, 0)')
    expect(keyframes[2]!['transform']).toBe('translate3d(50px, 0px, 0)')
    expect(String(keyframes[0]!['easing']).startsWith('linear(')).toBe(true)
    expect(String(keyframes[1]!['easing']).startsWith('linear(')).toBe(true)
    expect(keyframes[2]!['easing']).toBeUndefined() // last keyframe carries no easing
    expect(options['easing']).toBeUndefined() // per-keyframe, not animation-level
    expect(options['duration']).toBe(900)
  })

  it('carries untouched transform channels along as constants in every frame', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { x: 50 }, { scheduler }) // spring x to 50
    for (let t = 0; t <= 4000; t += 16) driver.frame(t)

    animate(element, { y: [0, 100, 50] }, { duration: 600, scheduler })
    const { keyframes } = animations[0]!
    expect(keyframes[0]!['transform']).toBe('translate3d(50px, 0px, 0)')
    expect(keyframes[1]!['transform']).toBe('translate3d(50px, 100px, 0)')
    expect(keyframes[2]!['transform']).toBe('translate3d(50px, 50px, 0)')
  })

  it('reclaims segment-local position and velocity per channel, then cancels', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { x: [0, 100, 50] }, { duration: 1000, easing: linear, scheduler })

    // progress 0.6 of 2 segments -> segment 1 (100 -> 50), local t 0.2:
    // pos = 100 + (-50)(0.2) = 90; velocity = (-50)/(0.5s) = -100 u/s
    animations[0]!.currentTime = 600
    animate(element, { x: 0 }, { scheduler }) // spring interrupt
    expect(animations[0]!.cancelled).toBe(true)

    driver.frame(0)
    expect(translateX(element)).toBeCloseTo(90, 5)
    driver.frame(16)
    expect(translateX(element)).toBeLessThan(90) // inherited -100 u/s drives it down
  })

  it('commits the final keyframe on finish, cancelling only after the render flush', async () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    const handle = animate(element, { x: [0, 100, 50] }, { duration: 800, scheduler })

    animations[0]!.onfinish?.()
    expect(animations[0]!.cancelled).toBe(false)
    driver.frame(0)
    expect(element.style.transform).toBe('translate3d(50px, 0px, 0)') // frames[n-1]
    expect(animations[0]!.cancelled).toBe(true)
    await handle.finished
  })

  it('falls back to the rAF path when frame counts differ across channels', async () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { x: [0, 100, 50], y: 30 }, { duration: 600, scheduler })

    expect(animations.length).toBe(0) // 3 frames vs 2 frames -> not uniform
    // The x chain advances between segments on a microtask, so flush them.
    let t = 0
    for (let guard = 0; guard < 10_000; guard++) {
      if (driver.pendingCount() > 0) {
        t += 16
        driver.frame(t)
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        if (driver.pendingCount() === 0) break
      }
    }
    expect(element.style.transform).toBe('translate3d(50px, 30px, 0)') // same endpoints
  })

  it('never delegates a registry property, and a property spring does not block a transform tween', () => {
    const { scheduler, element, animations } = setupWaapi()
    element.style.width = '100px'
    animate(element, { width: '200px' }, { scheduler }) // registry group, mid-physics
    expect(animations.length).toBe(0) // width never delegates

    animate(element, { x: 100 }, { duration: 300, scheduler })
    expect(animations.length).toBe(1) // a property group mid-physics does not block delegation
  })

  it('a relative resolves against the LIVE position of a delegated tween (reclaim before resolve)', () => {
    const { driver, scheduler, element, animations } = setupWaapi()
    animate(element, { x: 200 }, { duration: 1000, easing: linear, scheduler }) // delegates to WAAPI
    animations[0]!.currentTime = 500 // halfway on a linear 0->200 tween: live x == 100
    animate(element, { x: '+=50' }, { scheduler }) // relative -> reclaim the live 100, then +50
    for (let t = 0; t <= 4000; t += 16) driver.frame(t)
    expect(translateX(element)).toBeCloseTo(150, 0) // 100 (live) + 50, not 0 (stale) + 50
  })
})
