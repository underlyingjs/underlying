// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { linear } from '../physics/easings'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animate } from './animate'

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

/** Drive to `ms`, flushing microtasks each frame so a keyframe chain can hand off segments. */
async function driveTo(driver: Driver, ms: number): Promise<void> {
  for (let t = 0; t <= ms; t += 16) {
    driver.frame(t)
    await Promise.resolve()
  }
}

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

const translateX = (el: HTMLElement): number => {
  const m = /translate3d\((-?[\d.]+)px/.exec(el.style.transform)
  return m ? Number(m[1]) : 0
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('keyframe positions (at)', () => {
  it('front-loads a segment so an early `at` is reached early', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    // 0 -> 100 over the first 25% (100ms), then 100 -> 0 over the last 75% (300ms).
    animate(el, { x: [0, { value: 100, at: 0.25 }, 0] }, { duration: 400, easing: linear, scheduler })
    await driveTo(driver, 96)
    expect(translateX(el)).toBeGreaterThan(80) // near 100 by ~100ms (short first segment)
    await driveTo(driver, 256)
    const mid = translateX(el)
    expect(mid).toBeLessThan(90) // descending through the long second segment
    expect(mid).toBeGreaterThan(0)
  })
})

describe('keyframe per-segment easing (ease)', () => {
  it('applies a linear segment easing distinct from the default ease-in-out', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    // One linear segment: at 25% of the duration the value is ~25% of the way.
    animate(el, { x: [0, { value: 100, ease: linear }] }, { duration: 200, scheduler })
    await driveTo(driver, 48) // ~25% of 200ms
    expect(translateX(el)).toBeGreaterThan(18)
    expect(translateX(el)).toBeLessThan(32) // linear ~25; ease-in-out would be well under 18 here
  })
})

describe('keyframe hold (null mid-chain)', () => {
  it('holds the previous value across a null segment', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    // teleport 0, then 100, HOLD 100, then 0 - three even 133ms segments.
    animate(el, { x: [0, 100, null, 0] }, { duration: 399, easing: linear, scheduler })
    await driveTo(driver, 200) // inside the hold segment
    expect(translateX(el)).toBeGreaterThan(95) // parked at 100, not already falling
    await driveToRest(driver)
    expect(translateX(el)).toBeCloseTo(0, 0)
  })
})

describe('expressive keyframes on the registry (property) path', () => {
  it('positions a length keyframe segment', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    animate(el, { width: ['0px', { value: '100px', at: 0.25 }, '0px'] }, { duration: 400, easing: linear, scheduler })
    await driveTo(driver, 96)
    expect(Number.parseFloat(el.style.width)).toBeGreaterThan(80) // reached ~100px early
  })
})

describe('mixed bare + stop entries', () => {
  it('drives a keyframe array mixing bare values and stops to the final waypoint', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    const handle = animate(
      el,
      { x: [0, { value: 120, at: 0.3, ease: linear }, { value: 60, ease: linear }] },
      { duration: 300, scheduler },
    )
    await driveToRest(driver)
    await handle.finished
    expect(translateX(el)).toBeCloseTo(60, 0) // rests on the last stop's value
  })
})

describe('expressive keyframes stay on the JS path', () => {
  it('runs on the manual driver (never delegated to WAAPI) when a segment has custom easing', async () => {
    const { driver, scheduler, make } = setup()
    const el = make()
    // If this delegated to WAAPI, jsdom would never tick it and x would stay at 0.
    animate(el, { x: [0, { value: 100, ease: linear }, 0] }, { duration: 300, scheduler })
    await driveTo(driver, 150)
    expect(translateX(el)).toBeGreaterThan(0) // the JS loop advanced it
  })
})
