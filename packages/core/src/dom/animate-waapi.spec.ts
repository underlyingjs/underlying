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
