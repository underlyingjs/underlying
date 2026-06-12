import { afterEach, describe, expect, it, vi } from 'vitest'
import { rafDriver } from './driver'

describe('rafDriver', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('delegates to requestAnimationFrame', () => {
    const raf = vi.fn().mockReturnValue(7)
    vi.stubGlobal('requestAnimationFrame', raf)

    const callback = () => {}
    rafDriver.schedule(callback)
    expect(raf).toHaveBeenCalledWith(callback)
  })

  it('cancels via cancelAnimationFrame with the rAF id', () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(7))
    const caf = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', caf)

    const cancel = rafDriver.schedule(() => {})
    cancel()
    expect(caf).toHaveBeenCalledWith(7)
  })

  it('does not touch browser globals before schedule is called (SSR-safe)', () => {
    // No rAF stub here: merely importing the module and holding the driver
    // must not throw in a non-browser environment.
    expect(typeof rafDriver.schedule).toBe('function')
  })
})
