// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { __resetWarnings } from '../value/warn'
import { animate, releaseStyle, setStyle } from './animate'

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

function recordWrites(element: HTMLElement): Array<[string, string]> {
  const writes: Array<[string, string]> = []
  const original = element.style.setProperty.bind(element.style)
  vi.spyOn(element.style, 'setProperty').mockImplementation((property, value) => {
    writes.push([property, String(value)])
    original(property, String(value))
  })
  return writes
}

function widthOf(writes: Array<[string, string]>): number[] {
  return writes.filter(([property]) => property === 'width').map(([, value]) => parseFloat(value))
}

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
  __resetWarnings()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('setStyle', () => {
  it('writes a registry property synchronously and never wakes the loop', () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '100px'
    const writes = recordWrites(element)

    setStyle(element, { width: '200px' }, { scheduler })

    expect(writes).toEqual([['width', '200px']]) // synchronous
    expect(driver.pendingCount()).toBe(0)
    expect(driver.scheduleCalls()).toBe(0) // loop never scheduled
    driver.frame(0)
    driver.frame(16)
    expect(writes).toEqual([['width', '200px']]) // the next flush does not rewrite
  })

  it('seeds a velocity that a following spring inherits as momentum', async () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '120px'
    const writes = recordWrites(element)

    // Release a downward drag (negative velocity) then spring up to 300px.
    setStyle(element, { width: '120px' }, { scheduler, velocity: -500 })
    animate(element, { width: '300px' }, { scheduler })
    await driveToRest(driver)

    const widths = widthOf(writes)
    expect(Math.min(...widths)).toBeLessThan(120) // momentum carried it down first
    expect(widths.at(-1)).toBe(300) // then it springs to the target
  })

  it('only cancels animations on the touched properties', async () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '0px'
    animate(element, { x: 100, width: '200px' }, { scheduler })
    driver.frame(0)
    driver.frame(16)

    setStyle(element, { width: '50px' }, { scheduler })
    expect(driver.pendingCount()).toBeGreaterThan(0) // x is still springing
    await driveToRest(driver)
    expect(element.style.transform).toContain('translate3d(100px') // x reached its target
  })
})

describe('releaseStyle', () => {
  it('reclaims, removes our inline styles, and leaves the loop asleep', () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '100px'
    animate(element, { x: 100, width: '200px' }, { scheduler })
    driver.frame(0)
    driver.frame(16)

    releaseStyle(element)

    expect(element.style.transform).toBe('')
    expect(element.style.width).toBe('')
    expect(driver.pendingCount()).toBe(0)
  })

  it('makes the next animate() start cold from the current computed value', async () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '100px'
    animate(element, { width: '200px' }, { scheduler })
    await driveToRest(driver)
    releaseStyle(element)

    element.style.width = '150px' // a fresh start the cold read must pick up
    animate(element, { width: '250px' }, { scheduler })
    await driveToRest(driver)
    expect(element.style.width).toBe('250px')
  })

  it('is idempotent and a no-op for an unknown element', () => {
    const { driver, scheduler, element } = setup()
    animate(element, { x: 50 }, { scheduler })
    releaseStyle(element)
    expect(() => releaseStyle(element)).not.toThrow()
    expect(() => releaseStyle(document.createElement('span'))).not.toThrow()
    expect(driver.pendingCount()).toBe(0)
  })
})
