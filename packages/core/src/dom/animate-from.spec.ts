// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { __resetReducedMotion, setReducedMotionOverride } from '../a11y/reduced-motion'
import { staggerDelay } from '../compose/stagger-delay'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animate, from, fromTo } from './animate'

type Driver = ReturnType<typeof createManualDriver>

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const make = (): HTMLElement => {
    const el = document.createElement('div')
    document.body.append(el)
    return el
  }
  return { driver, scheduler, make }
}

const settle = (driver: Driver): void => {
  for (let t = 0; t <= 4000; t += 16) driver.frame(t)
}

/** Drive to rest, yielding to microtasks so a keyframe chain can advance its segments. */
async function driveToRest(driver: Driver): Promise<void> {
  let t = 0
  for (let guard = 0; guard < 100_000; guard++) {
    if (driver.pendingCount() > 0) {
      t += 16
      driver.frame(t)
    } else {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (driver.pendingCount() === 0) return
    }
  }
}

/** Read the px translateX out of a translate3d() transform, 0 when unset. */
const translateX = (el: HTMLElement): number => {
  const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)
  return m ? Number(m[1]) : 0
}

afterEach(() => {
  __resetReducedMotion()
  document.body.innerHTML = ''
})

describe('fromTo()', () => {
  it('parks the element at the from-state, then animates to the to-state', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    const handle = fromTo(el, { opacity: 0 }, { opacity: 1 }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    expect(Number(el.style.opacity)).toBeLessThan(0.5) // started from 0, not the natural 1
    settle(driver)
    await handle.finished
    expect(Number(el.style.opacity)).toBeCloseTo(1, 1)
  })

  it('keeps full target parity - the to-state may be keyframes', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    const handle = fromTo(el, { x: -40 }, { x: [0, 120, 60] }, { scheduler })
    await driveToRest(driver)
    await handle.finished
    expect(translateX(el)).toBeCloseTo(60, 0) // rests on the last keyframe
  })

  it('under reduced motion it skips the from-set and settles straight to the to-state', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, make } = setup()
    const el = make()
    fromTo(el, { opacity: 0 }, { opacity: 1 }, { scheduler, reducedMotion: 'skip' })
    driver.frame(0)
    driver.frame(16)
    expect(Number(el.style.opacity)).toBeCloseTo(1, 1) // never stranded at the from opacity 0
  })
})

describe('from()', () => {
  it('captures the natural value as the to-state and springs back to it', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    const handle = from(el, { x: 100 }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    expect(translateX(el)).toBeGreaterThan(50) // parked near the from x=100
    settle(driver)
    await handle.finished
    expect(translateX(el)).toBeCloseTo(0, 0) // back at the natural resting value
  })

  it('captures a PER-element natural, so each returns to its own resting value', async () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    animate(a, { x: 50 }, { scheduler }) // a now rests at 50, b untouched (0)
    settle(driver)
    const handle = from([a, b], { x: 100 }, { scheduler })
    settle(driver)
    await handle.finished
    expect(translateX(a)).toBeCloseTo(50, 0) // back to its own natural
    expect(translateX(b)).toBeCloseTo(0, 0)
  })

  it('under reduced motion it leaves each element at its natural value', () => {
    setReducedMotionOverride(true)
    const { driver, scheduler, make } = setup()
    const el = make()
    from(el, { x: 100 }, { scheduler, reducedMotion: 'skip' })
    driver.frame(0)
    driver.frame(16)
    expect(translateX(el)).toBeCloseTo(0, 0) // never parked at from x=100
  })
})

describe('from-state resolution', () => {
  it('parks every staggered element immediately and holds it through its own delay', () => {
    const { driver, scheduler, make } = setup()
    const a = make()
    const b = make()
    // A stiff spring so a's motion is visible within the window; b's 500ms delay outlasts it.
    fromTo([a, b], { x: 100 }, { x: 0 }, { stiffness: 400, damping: 40, delay: 500, scheduler })
    for (let t = 0; t <= 256; t += 16) driver.frame(t)
    // a (index 0, delay 0) has left the from-state toward 0; b (index 1, delay 500) is still parked at from x=100.
    expect(translateX(b)).toBeCloseTo(100, 0)
    expect(translateX(a)).toBeLessThan(50)
  })

  it('orders holds by a staggerDelay() wave without stranding any element', async () => {
    const { driver, scheduler, make } = setup()
    const els = [make(), make(), make()]
    const handle = fromTo(els, { y: 30 }, { y: 0 }, { delay: staggerDelay({ each: 120 }), scheduler })
    settle(driver)
    await handle.finished
    for (const el of els) expect(el.style.transform).toContain('translate3d(0px, 0px')
  })

  it('resolves a relative from-value against each element live value', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    animate(el, { x: 40 }, { scheduler })
    settle(driver)
    const handle = fromTo(el, { x: '+=60' }, { x: 40 }, { scheduler }) // from 40+60=100 back to 40
    driver.frame(0)
    driver.frame(16)
    expect(translateX(el)).toBeGreaterThan(80) // parked near 100
    settle(driver)
    await handle.finished
    expect(translateX(el)).toBeCloseTo(40, 0)
  })

  it('resolves a per-target function from-value', async () => {
    const { driver, scheduler, make } = setup()
    const els = [make(), make(), make()]
    const handle = fromTo(els, { x: (i) => i * 30 }, { x: 0 }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    expect(translateX(els[2]!)).toBeGreaterThan(translateX(els[0]!)) // index 2 parked farther out
    settle(driver)
    await handle.finished
    for (const el of els) expect(translateX(el)).toBeCloseTo(0, 0)
  })
})
