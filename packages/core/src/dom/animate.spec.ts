// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setReducedMotionBehavior } from '../a11y/config'
import { __resetReducedMotion } from '../a11y/reduced-motion'
import { linear } from '../physics/easings'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animate } from './animate'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const element = document.createElement('div')
  return { driver, scheduler, element }
}

const translateX = (element: HTMLElement): number =>
  Number(/translate3d\((-?[\d.]+)px/.exec(element.style.transform)?.[1] ?? Number.NaN)

describe('animate', () => {
  it('springs the requested channels to their targets', () => {
    const { driver, scheduler, element } = setup()
    animate(element, { x: 100, opacity: 0 }, { scheduler })

    for (let t = 0; t <= 4000; t += 16) driver.frame(t)
    expect(element.style.transform).toBe('translate3d(100px, 0px, 0)')
    expect(element.style.opacity).toBe('0')
  })

  it('a second call retargets the same values - interruption without jump', () => {
    const { driver, scheduler, element } = setup()
    animate(element, { x: 100 }, { scheduler })
    for (let t = 0; t <= 160; t += 16) driver.frame(t)
    const before = translateX(element)
    expect(before).toBeGreaterThan(0)

    animate(element, { x: 0 }, { scheduler })
    driver.frame(176)
    expect(Math.abs(translateX(element) - before)).toBeLessThan(10) // continuité

    for (let t = 192; t <= 6000; t += 16) driver.frame(t)
    expect(element.style.transform).toBe('translate3d(0px, 0px, 0)')
  })

  it('duration switches to the tween escape hatch', () => {
    const { driver, scheduler, element } = setup()
    animate(element, { x: 100 }, { duration: 480, easing: linear, scheduler })

    for (let t = 0; t <= 256; t += 16) driver.frame(t)
    expect(translateX(element)).toBeGreaterThan(40)
    expect(translateX(element)).toBeLessThan(60)

    for (let t = 272; t <= 800; t += 16) driver.frame(t)
    expect(translateX(element)).toBe(100)
  })

  it('returns a combined handle: stop freezes everything, finished resolves', async () => {
    const { driver, scheduler, element } = setup()
    const handle = animate(element, { x: 100, opacity: 0 }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)

    handle.stop()
    const frozen = translateX(element)
    for (let t = 48; t <= 400; t += 16) driver.frame(t)
    expect(translateX(element)).toBe(frozen)
    await handle.finished
  })

  it('channels start from sensible defaults (scale/opacity 1, x/y/rotate 0)', () => {
    const { driver, scheduler, element } = setup()
    animate(element, { scale: 2 }, { scheduler })
    expect(element.style.transform).toBe('scale(1)') // écriture initiale synchrone

    for (let t = 0; t <= 4000; t += 16) driver.frame(t)
    expect(element.style.transform).toBe('scale(2)')
  })
})

describe('animate under prefers-reduced-motion', () => {
  const stubReducedMotion = () =>
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: () => {},
      removeEventListener: () => {},
    }))

  beforeEach(() => {
    // Les tests précédents du fichier ont déjà initialisé le cache du media
    // query avec le matchMedia de jsdom - on repart de zéro avant de stubber.
    __resetReducedMotion()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    __resetReducedMotion()
    setReducedMotionBehavior('skip')
  })

  it('skip (défaut, zéro config) : tout snap instantanément', () => {
    stubReducedMotion()
    const { driver, scheduler, element } = setup()
    animate(element, { x: 100, opacity: 0 }, { scheduler })

    expect(element.style.transform).toBe('translate3d(100px, 0px, 0)')
    expect(element.style.opacity).toBe('0')
    expect(driver.pendingCount()).toBe(0) // aucune frame nécessaire
  })

  it("fade : le mouvement snap, l'opacité continue d'animer", () => {
    stubReducedMotion()
    setReducedMotionBehavior('fade')
    const { driver, scheduler, element } = setup()
    animate(element, { x: 100, opacity: 0 }, { scheduler })

    expect(element.style.transform).toBe('translate3d(100px, 0px, 0)') // snappé
    expect(element.style.opacity).toBe('1') // le fondu, lui, démarre à peine

    for (let t = 0; t <= 128; t += 16) driver.frame(t)
    const mid = Number(element.style.opacity)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)

    for (let t = 144; t <= 600; t += 16) driver.frame(t)
    expect(element.style.opacity).toBe('0')
  })

  it("reducedMotion: 'allow' sur l'appel laisse l'animation se dérouler", () => {
    stubReducedMotion()
    const { driver, scheduler, element } = setup()
    animate(element, { x: 100 }, { scheduler, reducedMotion: 'allow' })

    driver.frame(0)
    driver.frame(16)
    const mid = translateX(element)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(100)
  })
})
