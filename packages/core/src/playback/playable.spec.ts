import { afterEach, describe, expect, it, vi } from 'vitest'
import { __resetReducedMotion, setReducedMotionOverride } from '../a11y/reduced-motion'
import { linear } from '../physics/easings'
import { createManualDriver, type ManualDriver } from '../scheduler/manual-driver'
import { createScheduler } from '../scheduler/scheduler'
import { animatable } from '../value/animatable'
import { __resetWarnings } from '../value/warn'
import type { PlaybackHandle } from './handle'
import { playable } from './playable'

function setup(initial = 0) {
  const driver = createManualDriver()
  const scheduler = createScheduler(driver)
  const value = animatable(initial, { scheduler })
  return { driver, scheduler, value, pv: playable(value, { scheduler }) }
}

/** Pump 16 ms frames from a monotonic clock until the predicate holds; returns the new clock. */
function driveUntil(driver: ManualDriver, from: number, predicate: () => boolean, maxMs = 20_000): number {
  let t = from
  while (!predicate() && t - from <= maxMs) {
    driver.frame(t)
    t += 16
  }
  return t
}

/** Pump a fixed window of 16 ms frames; long enough to let any physics motion settle. */
function pumpMs(driver: ManualDriver, from: number, toMs: number): number {
  let t = from
  for (; t <= toMs; t += 16) driver.frame(t)
  return t
}

/** True once the seekable playhead has run its course; physics uses pumpMs instead (overshoot defeats progress()). */
const seekDone = (h: PlaybackHandle) => () => h.progress() === 1

afterEach(() => {
  __resetReducedMotion()
  __resetWarnings()
  vi.restoreAllMocks()
})

describe('playable - physics (live spring)', () => {
  it('reports its kind and is not seekable until baked', () => {
    const { pv } = setup()
    const h = pv.spring(100)
    expect(h.kind).toBe('physics')
    expect(h.seekable).toBe(false)
  })

  it('pause() freezes position and velocity exactly and sleeps the loop', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100)
    driver.frame(0)
    driver.frame(16)
    driver.frame(32)
    expect(value.get()).toBeGreaterThan(0)
    const pos = value.get()
    const vel = value.velocity()

    h.pause()
    expect(h.isPaused()).toBe(true)
    expect(driver.pendingCount()).toBe(0) // loop asleep
    driver.frame(48)
    driver.frame(64)
    expect(value.get()).toBe(pos)
    expect(value.velocity()).toBe(vel)

    h.play()
    expect(h.isPaused()).toBe(false)
    driver.frame(80)
    driver.frame(96)
    expect(value.get()).not.toBe(pos) // same trajectory continues
  })

  it('settles exactly on the target and resolves finished', async () => {
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100)
    pumpMs(driver, 0, 5000)
    expect(value.get()).toBe(100)
    expect(value.velocity()).toBe(0)
    await h.finished
  })

  it('timeScale keeps the trajectory shape, reaching a point in fewer wall-frames', () => {
    const a = setup(0)
    const b = setup(0)
    a.pv.spring(100)
    b.pv.spring(100, { timeScale: 2 })

    // Control runs 400 ms of wall time, the 2x run 200 ms: same motion-time.
    for (let t = 0; t <= 400; t += 8) a.driver.frame(t)
    for (let t = 0; t <= 200; t += 8) b.driver.frame(t)
    expect(b.value.get()).toBeCloseTo(a.value.get(), 6)
    expect(a.value.get()).not.toBe(100) // genuinely mid-flight, not both rested
  })

  it('reverse() retargets to the launch position, conserving velocity exactly', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100)
    const t = driveUntil(driver, 0, () => value.get() > 30)
    const vel = value.velocity()
    expect(vel).not.toBe(0)

    h.reverse()
    expect(value.velocity()).toBe(vel) // conserved at the instant of reverse

    pumpMs(driver, t, t + 5000)
    expect(value.get()).toBe(0) // home again
  })

  it('setTarget() re-aims a live spring conserving velocity', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100)
    const t = driveUntil(driver, 0, () => value.get() > 20)
    const vel = value.velocity()

    h.setTarget(-50)
    expect(value.velocity()).toBe(vel)
    pumpMs(driver, t, t + 5000)
    expect(value.get()).toBe(-50)
  })

  it('seek()/progress() warn once and no-op on a live spring', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100)
    driver.frame(0)
    driver.frame(16)
    const pos = value.get()

    h.seek(50)
    expect(value.get()).toBe(pos) // unchanged
    h.progress(0.5)
    expect(value.get()).toBe(pos)
    expect(warn).toHaveBeenCalledTimes(1) // one warn for the shared key
  })

  it('setTarget() warns once on a seekable (tween) handle', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { pv } = setup(0)
    const h = pv.to(100, { duration: 300, paused: true })
    h.setTarget(50)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})

describe('playable - timeline (tween)', () => {
  it('is seekable from birth and scrubs to an exact progress', () => {
    const { value, pv } = setup(0)
    const h = pv.to(120, { duration: 1000, easing: linear, paused: true })
    expect(h.kind).toBe('timeline')
    expect(h.seekable).toBe(true)

    h.progress(0.5)
    expect(value.get()).toBeCloseTo(60, 6)
    expect(h.progress()).toBeCloseTo(0.5, 6)
    expect(h.time()).toBeCloseTo(500, 6)
    expect(h.duration()).toBe(1000)

    h.seek(250)
    expect(value.get()).toBeCloseTo(30, 6)
  })

  it('plays forward to an exact rest', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.to(100, { duration: 320, easing: linear })
    driveUntil(driver, 0, seekDone(h))
    expect(value.get()).toBe(100)
  })

  it('reverses losslessly back to the start', () => {
    const { driver, value, pv } = setup(0)
    const h = pv.to(100, { duration: 320, easing: linear })
    const t = driveUntil(driver, 0, () => value.get() >= 50)
    h.reverse()
    driveUntil(driver, t, () => value.get() <= 0.001)
    expect(value.get()).toBeCloseTo(0, 6)
  })
})

describe('playable - reduced motion', () => {
  it('returns a settled, inert handle that jumped to the final value', async () => {
    setReducedMotionOverride(true)
    const { value, pv } = setup(0)
    const h = pv.spring(100)

    expect(value.get()).toBe(100) // fast-forwarded
    expect(h.seekable).toBe(true)
    expect(h.progress()).toBe(1)
    expect(h.duration()).toBe(0)
    expect(h.isPaused()).toBe(false)
    await h.finished

    // Controls are inert no-ops, never throwing.
    h.pause().timeScale(0.5)
    expect(value.get()).toBe(100)
  })

  it('honors a per-call allow override with real motion', () => {
    setReducedMotionOverride(true)
    const { driver, value, pv } = setup(0)
    const h = pv.spring(100, { reducedMotion: 'allow' })
    expect(value.get()).toBe(0) // did not fast-forward
    void h
    pumpMs(driver, 0, 5000)
    expect(value.get()).toBe(100)
  })
})
