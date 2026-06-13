// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetReducedMotion, setReducedMotionOverride } from '../a11y/reduced-motion'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { __resetWarnings } from '../value/warn'
import { animate } from './animate'

function setup() {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const parent = document.createElement('div')
  parent.style.width = '480px'
  const element = document.createElement('div')
  parent.appendChild(element)
  document.body.appendChild(parent)
  return { driver, scheduler, element }
}

/** Records every transform string written (bindStyle assigns it directly). */
function recordTransform(element: HTMLElement): string[] {
  const writes: string[] = []
  const style = element.style
  Object.defineProperty(element, 'style', {
    value: new Proxy(style, {
      set(target, property, value) {
        if (property === 'transform') writes.push(String(value))
        return Reflect.set(target, property, value)
      },
    }),
    configurable: true,
  })
  return writes
}

const translateX = (transform: string): number => Number(/translate3d\(([-\d.]+)px/.exec(transform)?.[1] ?? 'NaN')

/** Drive frames, flushing macrotasks between segments so the chain can advance. */
async function driveToRest(driver: ReturnType<typeof createManualDriver>): Promise<void> {
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

afterEach(() => {
  __resetReducedMotion()
  __resetWarnings()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('numeric keyframes', () => {
  it('teleports to keyframe 0, then springs through each waypoint, resting on the last', async () => {
    const { driver, scheduler, element } = setup()
    const writes = recordTransform(element)
    const handle = animate(element, { x: [0, 120, 80] }, { scheduler })
    await driveToRest(driver)

    expect(writes.some((t) => Math.round(translateX(t)) === 120)).toBe(true) // rested at the waypoint
    expect(translateX(writes.at(-1) ?? '')).toBe(80) // final waypoint, exact
    await expect(handle.finished).resolves.toBeUndefined()
  })

  it('starts from the current value when keyframe 0 is null (no teleport to 0)', async () => {
    const { driver, scheduler, element } = setup()
    animate(element, { x: 50 }, { scheduler })
    await driveToRest(driver)
    const writes = recordTransform(element)

    animate(element, { x: [null, 120, 80] }, { scheduler })
    await driveToRest(driver)

    expect(writes.every((t) => translateX(t) >= 50 - 0.001)).toBe(true) // never snapped back to 0
    expect(translateX(writes.at(-1) ?? '')).toBe(80)
  })

  it('aborts pending segments when interrupted by a new animate()', async () => {
    const { driver, scheduler, element } = setup()
    const writes = recordTransform(element)
    const chain = animate(element, { x: [0, 200, 400] }, { scheduler })
    driver.frame(16)
    driver.frame(32)
    animate(element, { x: 100 }, { scheduler }) // interrupt mid-flight
    await driveToRest(driver)

    expect(translateX(writes.at(-1) ?? '')).toBe(100)
    expect(writes.some((t) => Math.round(translateX(t)) === 400)).toBe(false) // never reached the dropped waypoint
    await expect(chain.finished).resolves.toBeUndefined()
  })

  it('freezes the current segment and cancels the rest on stop()', async () => {
    const { driver, scheduler, element } = setup()
    const writes = recordTransform(element)
    const handle = animate(element, { x: [0, 200, 400] }, { scheduler })
    driver.frame(16)
    driver.frame(32)
    handle.stop()
    const frozen = translateX(writes.at(-1) ?? '')

    driver.frame(48)
    driver.frame(64)
    expect(translateX(writes.at(-1) ?? '')).toBe(frozen)
    expect(frozen).toBeLessThan(200)
    await expect(handle.finished).resolves.toBeUndefined()
  })

  it('splits a duration evenly across segments (passes through the middle waypoint)', async () => {
    const { driver, scheduler, element } = setup()
    const writes = recordTransform(element)
    animate(element, { x: [0, 100, 200] }, { scheduler, duration: 600 })
    await driveToRest(driver)

    expect(writes.some((t) => Math.round(translateX(t)) === 100)).toBe(true) // segment boundary
    expect(translateX(writes.at(-1) ?? '')).toBe(200)
  })

  it('collapses to the final keyframe under reduced motion, skipping intermediates', () => {
    const { driver, scheduler, element } = setup()
    setReducedMotionOverride(true)
    const writes = recordTransform(element)
    animate(element, { x: [0, 120, 80] }, { scheduler, reducedMotion: 'skip' })
    driver.frame(16)

    expect(translateX(writes.at(-1) ?? '')).toBe(80)
    expect(writes.some((t) => Math.round(translateX(t)) === 120)).toBe(false) // no intermediate
  })
})

describe('property keyframes', () => {
  it('springs a length through its waypoints, resting on the last', async () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '0px'
    animate(element, { width: ['0px', '240px', '120px'] }, { scheduler })
    await driveToRest(driver)
    expect(element.style.width).toBe('120px')
  })

  it('snaps to the last entry and warns when keyframes mix units', () => {
    const { scheduler, element } = setup()
    element.style.width = '100px'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    animate(element, { width: ['10px', '50%'] }, { scheduler })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(element.style.width).toBe('50%')
  })
})
