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
  parent.style.height = '300px'
  const element = document.createElement('div')
  parent.appendChild(element)
  document.body.appendChild(parent)
  return { driver, scheduler, parent, element }
}

/** Spy on setProperty (the registry write path), recording and applying each write. */
function recordWrites(element: HTMLElement): Array<[string, string]> {
  const writes: Array<[string, string]> = []
  const original = element.style.setProperty.bind(element.style)
  vi.spyOn(element.style, 'setProperty').mockImplementation((property, value) => {
    writes.push([property, String(value)])
    original(property, String(value))
  })
  return writes
}

function driveToRest(driver: ReturnType<typeof createManualDriver>, maxFrames = 4000) {
  let t = 0
  for (let i = 0; i < maxFrames && driver.pendingCount() > 0; i++) {
    t += 16
    driver.frame(t)
  }
}

afterEach(() => {
  __resetReducedMotion()
  __resetWarnings()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('animate() registry routing', () => {
  it('converts a length from computed px to % once and rests on the exact target string', () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '120px' // 25% of the 480px parent
    animate(element, { width: '50%' }, { scheduler })
    driveToRest(driver)
    expect(element.style.width).toBe('50%') // spring ran in % space, exact rest
  })

  it('rebases a running % spring onto px when retargeted mid-flight, landing on the px target', () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '120px'
    animate(element, { width: '50%' }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    expect(element.style.width.endsWith('%')).toBe(true) // mid-flight in % space

    animate(element, { width: '480px' }, { scheduler }) // 100%, retarget to px
    driver.frame(48)
    expect(element.style.width.endsWith('px')).toBe(true) // rebased to px space
    driveToRest(driver)
    expect(element.style.width).toBe('480px')
  })

  it('snaps to a literal target it cannot decompose and warns once', () => {
    const { scheduler, element } = setup()
    element.style.width = '100px'
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const handle = animate(element, { width: '13ch' }, { scheduler })
    expect(element.style.width).toBe('13ch')
    expect(warn).toHaveBeenCalledTimes(1)
    return expect(handle.finished).resolves.toBeUndefined()
  })

  it('animates a color from the computed rgb() start to a byte-stable rgba()', () => {
    const { driver, scheduler, element } = setup()
    element.style.backgroundColor = 'rgb(0, 0, 0)'
    const writes = recordWrites(element)
    animate(element, { backgroundColor: '#10b981' }, { scheduler })
    driveToRest(driver)
    expect(writes.at(-1)).toEqual(['background-color', 'rgba(16, 185, 129, 1)'])
  })

  it('animates box-shadow from the zero-equivalent of an unset start', () => {
    const { driver, scheduler, element } = setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const writes = recordWrites(element)
    // No box-shadow set -> reconcile synthesizes a transparent zero-equivalent
    // start and the value actually animates (no snap, no warning).
    animate(element, { boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.5)' }, { scheduler })
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    expect(writes.at(-1)?.[1]).not.toBe('0px 12px 32px rgba(0, 0, 0, 0.5)') // mid-flight
    driveToRest(driver)
    expect(writes.at(-1)).toEqual(['box-shadow', '0px 12px 32px rgba(0, 0, 0, 0.5)'])
    expect(warn).not.toHaveBeenCalled()
  })

  it('animates box-shadow from an explicit none keyword', () => {
    const { driver, scheduler, element } = setup()
    element.style.boxShadow = 'none'
    const writes = recordWrites(element)
    animate(element, { boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)' }, { scheduler })
    driveToRest(driver)
    expect(writes.at(-1)).toEqual(['box-shadow', '0px 4px 8px rgba(0, 0, 0, 0.3)'])
  })

  it('keeps the five numeric channels off the registry write path', () => {
    const { driver, scheduler, element } = setup()
    const writes = recordWrites(element) // setProperty is the registry path only
    animate(element, { x: 100, opacity: 0.5 }, { scheduler })
    driveToRest(driver)
    expect(writes).toEqual([]) // numeric channels write via style.transform/.opacity
    expect(element.style.transform).toContain('translate3d(100px')
  })

  it('warns and ignores the transform shorthand key', () => {
    const { scheduler, element } = setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    animate(element, { transform: 'scale(2)' }, { scheduler })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(element.style.transform).toBe('')
  })

  it('returns one aggregate handle for a mixed numeric + string call that never rejects', async () => {
    const { driver, scheduler, element } = setup()
    element.style.width = '120px'
    const handle = animate(element, { x: 100, width: '50%' }, { scheduler })
    driveToRest(driver)
    await expect(handle.finished).resolves.toBeUndefined()
    expect(element.style.width).toBe('50%')
    expect(element.style.transform).toContain('translate3d(100px')
  })
})

describe('animate() registry routing under reduced motion', () => {
  it('settles a cold property in the synchronous bind write and never wakes the loop (skip)', () => {
    const { driver, scheduler, element } = setup()
    element.style.backgroundColor = 'rgb(0, 0, 0)'
    setReducedMotionOverride(true)
    const writes = recordWrites(element)

    animate(element, { backgroundColor: '#ff0000' }, { scheduler, reducedMotion: 'skip' })

    expect(writes).toEqual([['background-color', 'rgba(255, 0, 0, 1)']]) // one synchronous write
    expect(driver.pendingCount()).toBe(0) // loop never woken
    expect(driver.scheduleCalls()).toBe(0)
  })

  it('flushes a warm property in exactly one render frame (skip)', () => {
    const { driver, scheduler, element } = setup()
    element.style.backgroundColor = 'rgb(0, 0, 0)'
    animate(element, { backgroundColor: '#0000ff' }, { scheduler }) // warm it up
    driveToRest(driver)
    const writes = recordWrites(element)

    setReducedMotionOverride(true)
    animate(element, { backgroundColor: '#ff0000' }, { scheduler, reducedMotion: 'skip' })
    expect(driver.pendingCount()).toBe(1) // exactly one render flush pending
    driver.frame(10_000)
    expect(writes.at(-1)).toEqual(['background-color', 'rgba(255, 0, 0, 1)'])
    expect(driver.pendingCount()).toBe(0)
  })

  it('crossfades colors but snaps lengths under fade', () => {
    const { driver, scheduler, element } = setup()
    element.style.backgroundColor = 'rgb(0, 0, 0)'
    element.style.width = '100px'
    setReducedMotionOverride(true)
    const writes = recordWrites(element)

    animate(element, { backgroundColor: '#ff0000', width: '300px' }, { scheduler, reducedMotion: 'fade' })

    // Length snaps immediately (spatial); color is mid-crossfade, not yet at red.
    expect(writes.some(([property, value]) => property === 'width' && value === '300px')).toBe(true)
    const colorWrites = writes.filter(([property]) => property === 'background-color')
    expect(colorWrites.at(-1)?.[1]).not.toBe('rgba(255, 0, 0, 1)')

    driveToRest(driver)
    expect(writes.at(-1)).toEqual(['background-color', 'rgba(255, 0, 0, 1)'])
  })
})
